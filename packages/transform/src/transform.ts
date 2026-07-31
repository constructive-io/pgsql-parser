/**
 * AST-based Schema Name Transformer (Core Logic)
 * 
 * Pure transformation functions for converting schema names in SQL strings.
 * No file I/O — takes SQL strings in and returns transformed SQL strings out.
 * 
 * The transformer handles:
 * - Schema-qualified identifiers in RangeVar nodes (schema.table)
 * - Schema names in CreateSchemaStmt nodes
 * - Schema-qualified function names in FuncCall and CreateFunctionStmt nodes
 * - Schema-qualified type names in TypeName nodes
 * - Schema names in GrantStmt objects array
 * - Schema names in VariableSetStmt (SET search_path)
 * - Schema names in AlterDefaultPrivilegesStmt
 * - Schema names in DropStmt (DROP SCHEMA)
 * - Schema-qualified trigger function names in CreateTrigStmt
 * - Schema-qualified object references in CommentStmt
 * - Schema-qualified names in DefineStmt (CREATE TYPE, CREATE AGGREGATE)
 * - Schema-qualified names in CreateDomainStmt, CreateEnumStmt, AlterEnumStmt
 * - Schema-qualified names in AlterDomainStmt, AlterTypeStmt
 * - Schema-qualified names in ObjectWithArgs (ALTER FUNCTION, etc.)
 * - Schema name in AlterObjectSchemaStmt (ALTER ... SET SCHEMA)
 * - Schema names inside PL/pgSQL function bodies (hydrated AST)
 * - Comment headers, verify function calls, JSON string values (regex fallback)
 */

import { QuoteUtils } from '@pgsql/quotes';
import { walk, walkSqlAst } from '@pgsql/traverse';
import { Deparser,parseSql, transformSync, walkPlpgsqlAst } from 'plpgsql-parser';

import type { QualifyUnqualifiedOptions } from './qualify';
import { qualifyUnqualified } from './qualify';
import type { CapturedAsts } from './round-trip';
import { captureTransformAsts, validateRoundTrip } from './round-trip';
import type { RouteNamespace } from './router';
import { SchemaRouter } from './router';

/** A schema mapping accepted by the transform: the classic whole-schema map or a router. */
export type SchemaMappingInput = Map<string, string> | SchemaRouter;

/** Coerce any accepted mapping form into a {@link SchemaRouter}. */
function asRouter(mapping: SchemaMappingInput): SchemaRouter {
  return SchemaRouter.from(mapping);
}

/** Flat schema-level view for string-level passes that operate per source schema. */
function schemaLevelMap(mapping: SchemaMappingInput): Map<string, string> {
  return mapping instanceof SchemaRouter ? mapping.schemaLevelMap() : mapping;
}

export interface SchemaTransformResult {
  schemasFound: Set<string>;
  schemasTransformed: Map<string, string>;
  errors: Array<{ file: string; error: string }>;
}

/**
 * A pluggable string-level transform pass.
 *
 * Extension passes run on the raw SQL text before or after the core AST
 * transformation.  They exist for content that is opaque to the SQL parser
 * (string literals, comments, JSON values, etc.).
 *
 * Each pass receives the current content string, the schema mapping, and the
 * shared result tracker, and must return the (possibly transformed) content.
 */
export type SchemaTransformPass = (
  content: string,
  schemaMapping: Map<string, string>,
  result: SchemaTransformResult
) => string;

/**
 * Options for transform_sql.
 */
export interface TransformSqlOptions {
  /**
   * Extension passes that run BEFORE the core AST transformation.
   * Use these for app-specific string-level transforms that must happen
   * before the parser sees the content (e.g. verify calls, JSON values).
   */
  prePasses?: SchemaTransformPass[];

  /**
   * Extension passes that run AFTER the core AST transformation.
   * Use these for app-specific transforms on the deparsed output.
   */
  postPasses?: SchemaTransformPass[];

  /**
   * Validate that the emitted SQL re-parses to an AST structurally identical
   * to the transformed AST that was deparsed (catches deparser fidelity bugs
   * such as dropped array bounds). Adds a second parse per file.
   */
  roundTrip?: boolean;

  /**
   * Qualify unqualified object references BEFORE the schema mapping runs
   * (an extra AST pass, opt-in). Pin unqualified references to a schema
   * (typically `'public'`) so a mapping on that schema moves them too —
   * the ingestion path for handwritten, unqualified SQL. Only names in the
   * inventory (defaulting to objects the content itself creates) are
   * qualified. See {@link qualifyUnqualified}.
   */
  qualifyUnqualified?: QualifyUnqualifiedOptions;

  /**
   * Schema names (post-mapping) whose `CREATE SCHEMA` statements should be
   * emitted as `CREATE SCHEMA IF NOT EXISTS`. Use when mapping into a schema
   * that always exists — e.g. mapping a named schema onto `public`.
   */
  assumeSchemasExist?: string[];
}

/**
 * Create a fresh result object
 */
function createResult(): SchemaTransformResult {
  return {
    schemasFound: new Set(),
    schemasTransformed: new Map(),
    errors: [],
  };
}

/**
 * Routing claims: each routable site (a RangeVar, a qualified name list, a
 * bare schema-name field) is resolved through the router at most once per
 * transform result.
 *
 * The walker visits parents before children, so a statement-level handler
 * with namespace context (e.g. `AlterFunctionStmt` routing its
 * `ObjectWithArgs` as a `function`) claims the site before a generic child
 * visitor (`ObjectWithArgs`, namespace `unknown`) reaches it — first (most
 * contextual) visitor wins. Without claims a site is routed twice, which
 * corrupts cyclic mappings (a→b, b→a swaps back) and applies the less precise
 * namespace second.
 */
const routingClaims = new WeakMap<SchemaTransformResult, WeakMap<object, Set<string>>>();

function claimSite(result: SchemaTransformResult, site: object, field = '*'): boolean {
  let byNode = routingClaims.get(result);
  if (!byNode) {
    byNode = new WeakMap();
    routingClaims.set(result, byNode);
  }
  let fields = byNode.get(site);
  if (!fields) {
    fields = new Set();
    byNode.set(site, fields);
  }
  if (fields.has(field)) return false;
  fields.add(field);
  return true;
}

/**
 * Transform a schema name if it exists in the mapping
 */
export function transformSchemaName(
  schemaName: string | undefined,
  schemaMapping: Map<string, string>
): string | undefined {
  if (!schemaName) return schemaName;
  return schemaMapping.get(schemaName) ?? schemaName;
}

/**
 * Check if a schema name should be transformed
 */
export function shouldTransformSchema(
  schemaName: string | undefined,
  schemaMapping: Map<string, string>
): boolean {
  if (!schemaName) return false;
  return schemaMapping.has(schemaName);
}

/**
 * Transform schema names in a String node array (used for funcname, names, etc.)
 * These arrays contain String nodes like { String: { sval: 'schema_name' } }
 *
 * `ns` names the namespace of the referenced object so object-level routes can
 * apply; the object's own name is the last element of the list. When `ns` is
 * `unknown` (the default) only the schema-level default applies — identical to
 * the historic whole-schema behaviour.
 */
export function transformNameList(
  names: any[] | undefined,
  schemaMapping: SchemaMappingInput,
  result: SchemaTransformResult,
  ns: RouteNamespace = 'unknown'
): void {
  if (!names || names.length < 2) return;
  if (!claimSite(result, names)) return;
  const router = asRouter(schemaMapping);

  // For schema-qualified names, the first element is the schema.
  const first = names[0];
  if (first?.String?.sval) {
    const schemaName = first.String.sval;
    const last = names[names.length - 1];
    const objName = last?.String?.sval;
    const target = router.resolveObject(schemaName, objName, ns);
    if (!target) return;
    if (target.name !== undefined && last?.String?.sval) {
      result.schemasFound.add(schemaName);
      last.String.sval = target.name;
    }
    if (target.schema === null) {
      // De-qualify: drop the schema element and rely on search_path.
      result.schemasFound.add(schemaName);
      names.splice(0, 1);
    } else if (target.schema && target.schema !== schemaName) {
      result.schemasFound.add(schemaName);
      first.String.sval = target.schema;
      result.schemasTransformed.set(schemaName, target.schema);
    }
  }
}

/**
 * Transform a bare schema-name field on a node (e.g. { String: { sval } }
 * entries in GrantStmt.objects, RenameStmt.subname, CommentStmt.object).
 * Returns the (possibly new) schema name.
 */
export function transformSchemaNameField(
  container: any,
  field: string,
  schemaMapping: SchemaMappingInput,
  result: SchemaTransformResult
): void {
  const schemaName = container?.[field];
  if (typeof schemaName !== 'string') return;
  if (!claimSite(result, container, field)) return;
  // A bare schema name is an operation on the schema itself: only the
  // schema-level default applies.
  const newName = asRouter(schemaMapping).resolve(schemaName, undefined, 'schema');
  if (newName && newName !== schemaName) {
    result.schemasFound.add(schemaName);
    container[field] = newName;
    result.schemasTransformed.set(schemaName, newName);
  }
}

/**
 * Transform a RangeVar-like relation object (has schemaname/relname fields).
 * The walker auto-recurses into embedded relations (concrete `RangeVar`
 * fields are tag-synthesized), so the generic `RangeVar` visitor covers
 * every occurrence; statement handlers call this directly only when they
 * carry extra context, and the claim guard keeps each relation routed once.
 */
export function transformRelation(
  relation: any,
  schemaMapping: SchemaMappingInput,
  result: SchemaTransformResult
): void {
  if (!relation?.schemaname) return;
  if (!claimSite(result, relation)) return;
  const oldName = relation.schemaname;
  // A RangeVar names a relation (table/view/sequence/matview); route by the
  // relation name so object-level routes can send it to its own schema.
  const target = asRouter(schemaMapping).resolveObject(oldName, relation.relname, 'relation');
  if (!target) return;
  if (target.name !== undefined && relation.relname) {
    result.schemasFound.add(oldName);
    relation.relname = target.name;
  }
  if (target.schema === null) {
    // De-qualify: drop the schema qualifier and rely on search_path.
    result.schemasFound.add(oldName);
    delete relation.schemaname;
  } else if (target.schema && target.schema !== oldName) {
    result.schemasFound.add(oldName);
    relation.schemaname = target.schema;
    result.schemasTransformed.set(oldName, target.schema);
  }
}

/**
 * Transform schema-qualified references embedded in a plain string
 * (e.g. advisory-lock keys like 'schema-name.fn_name', COMMENT text,
 * RAISE messages). Only occurrences of a mapped schema name immediately
 * followed by a dot are rewritten.
 */
export function transformSchemaRefsInString(
  str: string,
  schemaMapping: SchemaMappingInput,
  result: SchemaTransformResult
): string {
  let out = str;
  // References embedded in opaque strings carry no object identity, so only
  // whole-schema (schema-level default) routes can be applied here.
  for (const [oldSchema, newSchema] of schemaLevelMap(schemaMapping)) {
    const pattern = new RegExp(`(?<![\\w-])("?)${escapeRegexp(oldSchema)}\\1(?=\\.)`, 'g');
    const before = out;
    out = out.replace(pattern, `$1${newSchema}$1`);
    if (out !== before) {
      result.schemasFound.add(oldSchema);
      result.schemasTransformed.set(oldSchema, newSchema);
    }
  }
  return out;
}

/**
 * Create a SQL AST visitor that transforms schema names.
 * 
 * The walker from @pgsql/traverse auto-recurses into child nodes, so visitors
 * like RangeVar and TypeName fire for every occurrence regardless of parent.
 * However, some node types carry schema names as plain strings or name lists
 * that require explicit handlers.
 */
export function createSqlVisitor(
  schemaMapping: SchemaMappingInput,
  result: SchemaTransformResult,
  visitorOptions?: { assumeSchemasExist?: Set<string> }
) {
  const router = asRouter(schemaMapping);
  const assumeSchemasExist = visitorOptions?.assumeSchemasExist;
  const useAstBodies = router.hasObjectRoutes();

  // Rewrite a bare schema-name string field in place (schema-level default).
  const rewriteSchemaField = (container: any, key: string): void => {
    const schemaName = container?.[key];
    if (typeof schemaName !== 'string') return;
    if (!claimSite(result, container, key)) return;
    const newName = router.resolve(schemaName, undefined, 'schema');
    if (newName && newName !== schemaName) {
      result.schemasFound.add(schemaName);
      container[key] = newName;
      result.schemasTransformed.set(schemaName, newName);
    }
  };

  // Namespace of the object a DROP/ALTER targets, from its removeType, so
  // object routes apply to DROP TABLE/FUNCTION/TYPE (e.g. revert scripts).
  const namespaceOfObjectType = (objType: string | undefined): RouteNamespace => {
    switch (objType) {
      case 'OBJECT_TABLE':
      case 'OBJECT_VIEW':
      case 'OBJECT_SEQUENCE':
      case 'OBJECT_MATVIEW':
      case 'OBJECT_FOREIGN_TABLE':
      case 'OBJECT_INDEX':
        return 'relation';
      case 'OBJECT_FUNCTION':
      case 'OBJECT_PROCEDURE':
      case 'OBJECT_AGGREGATE':
      case 'OBJECT_ROUTINE':
        return 'function';
      case 'OBJECT_TYPE':
      case 'OBJECT_DOMAIN':
        return 'type';
      default:
        return 'unknown';
    }
  };

  return {
    // Transform RangeVar nodes (table references)
    RangeVar: (path: any) => {
      transformRelation(path.node, router, result);
    },
    
    // Transform CreateSchemaStmt nodes
    CreateSchemaStmt: (path: any) => {
      const node = path.node;
      if (node.schemaname) {
        const oldName = node.schemaname;
        // The schema object itself: schema-level default only.
        const newName = router.resolve(oldName, undefined, 'schema');
        if (newName && newName !== oldName) {
          node.schemaname = newName;
          result.schemasFound.add(oldName);
          result.schemasTransformed.set(oldName, newName);
        }
      }
      if (node.schemaname && assumeSchemasExist?.has(node.schemaname)) {
        node.if_not_exists = true;
      }
    },
    
    // Transform FuncCall nodes (function calls with schema-qualified names)
    FuncCall: (path: any) => {
      const node = path.node;
      transformNameList(node.funcname, router, result, 'function');
    },

    
    // Transform TypeName nodes (type references with schema-qualified names)
    TypeName: (path: any) => {
      const node = path.node;
      transformNameList(node.names, router, result, 'type');
    },
    
    // Transform ColumnRef nodes (column references with schema-qualified names).
    // A qualified column is schema.table.column — the routed object is the
    // table, which we cannot disambiguate from the schema here, so only the
    // schema-level default applies.
    ColumnRef: (path: any) => {
      const node = path.node;
      transformNameList(node.fields, router, result);
    },
    
    // Transform GrantStmt objects (GRANT ON SCHEMA schema;
    // GRANT ... ON ALL TABLES/FUNCTIONS/SEQUENCES IN SCHEMA schema)
    GrantStmt: (path: any) => {
      const node = path.node;
      // For schema-name targets, objects contains String nodes with schema names
      if ((node.objtype === 'OBJECT_SCHEMA' || node.targtype === 'ACL_TARGET_ALL_IN_SCHEMA') && node.objects) {
        for (const obj of node.objects) {
          if (obj?.String) {
            transformSchemaNameField(obj.String, 'sval', schemaMapping, result);
          }
        }
      }
    },
    
    // Transform VariableSetStmt (SET search_path)
    VariableSetStmt: (path: any) => {
      const node = path.node;
      if (node.name === 'search_path' && node.args) {
        for (const arg of node.args) {
          // search_path args can be String nodes or A_Const with sval
          if (arg?.String?.sval) {
            rewriteSchemaField(arg.String, 'sval');
          } else if (arg?.A_Const?.sval?.sval) {
            rewriteSchemaField(arg.A_Const.sval, 'sval');
          }
        }
      }
    },
    
    // Transform AlterDefaultPrivilegesStmt (ALTER DEFAULT PRIVILEGES IN SCHEMA)
    AlterDefaultPrivilegesStmt: (path: any) => {
      const node = path.node;
      if (node.options) {
        for (const opt of node.options) {
          if (opt?.DefElem?.defname === 'schemas' && opt.DefElem.arg?.List?.items) {
            for (const item of opt.DefElem.arg.List.items) {
              if (item?.String?.sval) {
                rewriteSchemaField(item.String, 'sval');
              }
            }
          }
        }
      }
    },
    
    // Transform DropStmt (DROP SCHEMA name; DROP TABLE/INDEX/POLICY/TRIGGER/
    // TYPE/FUNCTION schema.obj) with the namespace derived from removeType,
    // so object routes apply; claims stop the generic List/ObjectWithArgs
    // visitors from re-routing the same names with namespace `unknown`.
    DropStmt: (path: any) => {
      const node = path.node;
      if (node.removeType !== 'OBJECT_SCHEMA' && Array.isArray(node.objects)) {
        const ns = namespaceOfObjectType(node.removeType);
        for (const obj of node.objects) {
          if (obj?.List?.items) {
            transformNameList(obj.List.items, router, result, ns);
          } else if (obj?.ObjectWithArgs?.objname) {
            transformNameList(obj.ObjectWithArgs.objname, router, result, ns);
          } else if (obj?.TypeName?.names) {
            transformNameList(obj.TypeName.names, router, result, ns);
          }
        }
        return;
      }
      if (node.removeType === 'OBJECT_SCHEMA' && node.objects) {
        for (const obj of node.objects) {
          // DROP SCHEMA objects can be List of String nodes
          if (obj?.List?.items) {
            for (const item of obj.List.items) {
              if (item?.String?.sval) {
                rewriteSchemaField(item.String, 'sval');
              }
            }
          } else if (obj?.String?.sval) {
            rewriteSchemaField(obj.String, 'sval');
          }
        }
      }
    },
    
    // Transform AlterSeqStmt OWNED BY (schema name in DefElem.arg.List.items;
    // a bare name list no generic visitor covers)
    AlterSeqStmt: (path: any) => {
      const node = path.node;
      if (node.options) {
        for (const opt of node.options) {
          if (opt?.DefElem?.defname === 'owned_by' && opt.DefElem?.arg?.List?.items) {
            transformNameList(opt.DefElem.arg.List.items, schemaMapping, result);
          }
        }
      }
    },

    // Transform CreateFunctionStmt (CREATE FUNCTION schema.funcname).
    // funcname is a bare name list (no generic visitor); return and parameter
    // types are TypeName nodes the walker reaches on its own.
    CreateFunctionStmt: (path: any) => {
      const node = path.node;
      transformNameList(node.funcname, schemaMapping, result, 'function');
      // Transform schema-qualified references inside the function body
      // (AS $$...$$ is a String under the 'as' DefElem, which the walker
      // does not parse as SQL). LANGUAGE plpgsql bodies are additionally
      // rebuilt from the PL/pgSQL AST by transformSync; for LANGUAGE sql
      // functions this string is the deparsed body.
      if (Array.isArray(node.options)) {
        for (const opt of node.options) {
          if (opt?.DefElem?.defname === 'as' && opt.DefElem.arg?.List?.items) {
            for (const item of opt.DefElem.arg.List.items) {
              if (typeof item?.String?.sval !== 'string') continue;
              // With object routes, references inside a LANGUAGE sql body must
              // be rewritten AST-precisely; whole-schema routes keep the
              // cheaper (and quoting-preserving) string pass.
              if (useAstBodies) {
                item.String.sval = transformSqlBodyString(item.String.sval, router, result);
              } else if (item.String.sval.includes('.')) {
                item.String.sval = transformSchemaRefsInString(item.String.sval, router, result);
              }
            }
          }
        }
      }
    },

    // Transform CreateTrigStmt (CREATE TRIGGER ... EXECUTE PROCEDURE schema.func)
    // funcname is a bare name list; the ON relation is a RangeVar the walker
    // reaches on its own.
    CreateTrigStmt: (path: any) => {
      const node = path.node;
      transformNameList(node.funcname, schemaMapping, result, 'function');
    },

    // Transform CommentStmt (COMMENT ON TABLE/COLUMN/FUNCTION schema.obj,
    // COMMENT ON SCHEMA schema)
    CommentStmt: (path: any) => {
      const node = path.node;
      // The object field structure varies by objtype.
      // For tables/views/etc, object is { List: { items: [{ String: ... }, ...] } }
      // For functions, object is { ObjectWithArgs: { objname: [...] } }
      // For schemas, object is a bare { String: { sval } }
      if (node.object) {
        const ns = namespaceOfObjectType(node.objtype);
        // Handle List-wrapped objects (COMMENT ON TABLE schema.tbl, COMMENT ON COLUMN schema.tbl.col)
        if (node.object?.List?.items) {
          transformNameList(node.object.List.items, schemaMapping, result, ns);
        }
        // Handle ObjectWithArgs-style objects (COMMENT ON FUNCTION schema.func(args))
        else if (node.object?.ObjectWithArgs?.objname) {
          transformNameList(node.object.ObjectWithArgs.objname, schemaMapping, result, ns);
        }
        // Handle bare schema names (COMMENT ON SCHEMA schema)
        else if (node.object?.String && node.objtype === 'OBJECT_SCHEMA') {
          transformSchemaNameField(node.object.String, 'sval', schemaMapping, result);
        }
      }
      // Transform schema-qualified references inside the comment text itself
      if (typeof node.comment === 'string') {
        node.comment = transformSchemaRefsInString(node.comment, schemaMapping, result);
      }
    },

    // Transform schema-qualified references embedded in string constants
    // (e.g. advisory-lock keys: hashtextextended('schema.fn_name', 0))
    A_Const: (path: any) => {
      const node = path.node;
      if (typeof node.sval?.sval === 'string' && node.sval.sval.includes('.')) {
        node.sval.sval = transformSchemaRefsInString(node.sval.sval, schemaMapping, result);
      }
    },

    // Transform DefineStmt (CREATE TYPE schema.name, CREATE AGGREGATE schema.agg)
    DefineStmt: (path: any) => {
      const node = path.node;
      transformNameList(node.defnames, schemaMapping, result);
    },

    // Transform CreateDomainStmt (CREATE DOMAIN schema.domname)
    CreateDomainStmt: (path: any) => {
      const node = path.node;
      transformNameList(node.domainname, schemaMapping, result, 'type');
    },

    // Transform CreateEnumStmt (CREATE TYPE schema.enumname AS ENUM)
    CreateEnumStmt: (path: any) => {
      const node = path.node;
      transformNameList(node.typeName, schemaMapping, result, 'type');
    },

    // Transform AlterEnumStmt (ALTER TYPE schema.enumname ADD VALUE)
    AlterEnumStmt: (path: any) => {
      const node = path.node;
      transformNameList(node.typeName, schemaMapping, result, 'type');
    },

    // Transform AlterDomainStmt (ALTER DOMAIN schema.domname)
    AlterDomainStmt: (path: any) => {
      const node = path.node;
      transformNameList(node.typeName, schemaMapping, result, 'type');
    },

    // Transform AlterTypeStmt (ALTER TYPE schema.typename)
    // Note: composite type alters use RangeVar (handled by RangeVar visitor),
    // but some ALTER TYPE statements use typeName as a name list
    AlterTypeStmt: (path: any) => {
      const node = path.node;
      transformNameList(node.typeName, schemaMapping, result, 'type');
    },

    // Transform ObjectWithArgs (used in ALTER FUNCTION, DROP FUNCTION with args, etc.)
    ObjectWithArgs: (path: any) => {
      const node = path.node;
      transformNameList(node.objname, schemaMapping, result);
    },

    // Transform AlterObjectSchemaStmt (ALTER ... SET SCHEMA newschema):
    // object name lists and the destination schema. The relation form is a
    // RangeVar the walker reaches on its own.
    AlterObjectSchemaStmt: (path: any) => {
      const node = path.node;
      const ns = namespaceOfObjectType(node.objectType);
      // Non-relation objects (ALTER TYPE/FUNCTION ... SET SCHEMA)
      if (node.object?.List?.items) {
        transformNameList(node.object.List.items, schemaMapping, result, ns);
      } else if (node.object?.ObjectWithArgs?.objname) {
        transformNameList(node.object.ObjectWithArgs.objname, schemaMapping, result, ns);
      } else if (node.object?.TypeName?.names) {
        transformNameList(node.object.TypeName.names, schemaMapping, result, ns);
      }
      // Transform the newschema (destination schema)
      transformSchemaNameField(node, 'newschema', schemaMapping, result);
    },

    // Transform RenameStmt (ALTER SCHEMA old RENAME TO new;
    // ALTER TABLE schema.tbl RENAME ...). The relation form is a RangeVar
    // the walker reaches on its own.
    RenameStmt: (path: any) => {
      const node = path.node;
      if (node.renameType === 'OBJECT_SCHEMA') {
        // subname is the old schema name; newname is the target
        transformSchemaNameField(node, 'subname', schemaMapping, result);
        transformSchemaNameField(node, 'newname', schemaMapping, result);
      }
      const ns = namespaceOfObjectType(node.renameType);
      if (node.object?.List?.items) {
        transformNameList(node.object.List.items, schemaMapping, result, ns);
      } else if (node.object?.ObjectWithArgs?.objname) {
        transformNameList(node.object.ObjectWithArgs.objname, schemaMapping, result, ns);
      }
    },

    // Transform AlterFunctionStmt (ALTER FUNCTION schema.fn(...) SET ...)
    AlterFunctionStmt: (path: any) => {
      const node = path.node;
      if (node.func?.objname) {
        transformNameList(node.func.objname, schemaMapping, result, 'function');
      }
    },

    // Transform AlterOwnerStmt (ALTER ... OWNER TO role)
    AlterOwnerStmt: (path: any) => {
      const node = path.node;
      const ns = namespaceOfObjectType(node.objectType);
      if (node.object?.List?.items) {
        transformNameList(node.object.List.items, schemaMapping, result, ns);
      } else if (node.object?.ObjectWithArgs?.objname) {
        transformNameList(node.object.ObjectWithArgs.objname, schemaMapping, result, ns);
      } else if (node.object?.String && node.objectType === 'OBJECT_SCHEMA') {
        transformSchemaNameField(node.object.String, 'sval', schemaMapping, result);
      }
    },

    // Transform CreateCastStmt (CREATE CAST (src AS tgt) WITH FUNCTION fn).
    // The function name gets its `function` namespace here; the cast's
    // source/target/argument types are TypeName nodes the walker reaches on
    // its own.
    CreateCastStmt: (path: any) => {
      const node = path.node;
      if (node.func?.objname) {
        transformNameList(node.func.objname, schemaMapping, result, 'function');
      }
    },

    // Transform CreateEventTrigStmt (CREATE EVENT TRIGGER ... EXECUTE FUNCTION schema.fn())
    CreateEventTrigStmt: (path: any) => {
      const node = path.node;
      transformNameList(node.funcname, schemaMapping, result, 'function');
    },

    // Transform IndexElem opclass (CREATE INDEX ... (col schema.opclass))
    IndexElem: (path: any) => {
      const node = path.node;
      transformNameList(node.opclass, schemaMapping, result);
    },

    // Transform SecLabelStmt object (SECURITY LABEL ... ON COLUMN schema.tbl.col)
    SecLabelStmt: (path: any) => {
      const node = path.node;
      if (node.object?.List?.items) {
        transformNameList(node.object.List.items, schemaMapping, result);
      } else if (node.object?.ObjectWithArgs?.objname) {
        transformNameList(node.object.ObjectWithArgs.objname, schemaMapping, result);
      }
    },

    // Transform DO block bodies. The body is an opaque string under the 'as'
    // DefElem; schema-qualified references are rewritten with the strict
    // schema-followed-by-dot pattern.
    DoStmt: (path: any) => {
      const node = path.node;
      if (Array.isArray(node.args)) {
        for (const arg of node.args) {
          if (arg?.DefElem?.defname === 'as' && typeof arg.DefElem.arg?.String?.sval === 'string') {
            arg.DefElem.arg.String.sval = transformSchemaRefsInString(
              arg.DefElem.arg.String.sval, schemaMapping, result
            );
          }
        }
      }
    },
  };
}

/**
 * Validate that no untransformed schema names remain in the output.
 * Checks both schema-qualified references (schema.object) and standalone
 * schema name contexts (ON SCHEMA, IN SCHEMA, CREATE SCHEMA, etc.).
 * 
 * Throws an error if any schema names from the mapping are found in the output,
 * indicating that the AST visitor is missing a handler for that node type.
 */
export function validateNoUntransformedSchemas(
  content: string,
  schemaMapping: SchemaMappingInput
): void {
  // Only schemas with a schema-level default are guaranteed to move entirely;
  // partially (object-only) routed schemas may legitimately keep some
  // references, so they are excluded from the strict leftover check.
  const moved =
    schemaMapping instanceof SchemaRouter ? schemaMapping.fullyMovedSchemas() : schemaMapping;
  if (moved.size === 0) {
    return;
  }
  
  for (const [oldSchema, newSchema] of moved) {
    const escapedSchema = escapeRegexp(oldSchema);
    
    // Pattern 1: quoted or unquoted schema name followed by dot (schema-qualified)
    const dotPattern = new RegExp(`(?:"${escapedSchema}"|\\b${escapedSchema})(?=\\.)`, 'g');
    
    // Pattern 2: standalone schema name in known SQL contexts
    // Note: We don't use trailing \b because it fails after closing quotes
    // (both '"' and whitespace are non-word characters, so no boundary exists).
    const standalonePattern = new RegExp(
      `(?:ON\\s+SCHEMA\\s+|IN\\s+SCHEMA\\s+|CREATE\\s+SCHEMA\\s+|DROP\\s+SCHEMA\\s+(?:IF\\s+EXISTS\\s+)?|SET\\s+SCHEMA\\s+)` +
      `(?:"${escapedSchema}"|\\b${escapedSchema}\\b)`,
      'gi'
    );
    
    const dotMatches = content.match(dotPattern);
    const standaloneMatches = content.match(standalonePattern);
    const totalMatches = (dotMatches?.length || 0) + (standaloneMatches?.length || 0);
    
    if (totalMatches > 0) {
      const lines = content.split('\n');
      const locations: string[] = [];
      
      const combinedPattern = new RegExp(
        `(?:"${escapedSchema}"|\\b${escapedSchema})(?=\\.)|` +
        `(?:ON\\s+SCHEMA\\s+|IN\\s+SCHEMA\\s+|CREATE\\s+SCHEMA\\s+|DROP\\s+SCHEMA\\s+(?:IF\\s+EXISTS\\s+)?|SET\\s+SCHEMA\\s+)` +
        `(?:"${escapedSchema}"|\\b${escapedSchema}\\b)`,
        'gi'
      );
      
      for (let i = 0; i < lines.length; i++) {
        if (combinedPattern.test(lines[i])) {
          locations.push(`  Line ${i + 1}: ${lines[i].trim()}`);
        }
        combinedPattern.lastIndex = 0;
      }
      
      throw new Error(
        `AST transformation incomplete: found ${totalMatches} untransformed schema name(s) "${oldSchema}" ` +
        `that should have been transformed to "${newSchema}". ` +
        `This indicates a missing visitor handler in create_sql_visitor or walk_plpgsql_for_schemas.\n` +
        `Locations:\n${locations.join('\n')}`
      );
    }
  }
}

/**
 * Create a PL/pgSQL visitor that transforms schema names in PL/pgSQL-specific nodes.
 */
export function createPlpgsqlVisitor(
  schemaMapping: SchemaMappingInput,
  result: SchemaTransformResult
) {
  const schemaMap = schemaLevelMap(schemaMapping);
  return {
    PLpgSQL_type: (path: any) => {
      const node = path.node;
      if (node.typname) {
        for (const [oldSchema, newSchema] of schemaMap.entries()) {
          if (node.typname.startsWith(oldSchema + '.')) {
            const typeName = node.typname.substring(oldSchema.length + 1);
            result.schemasFound.add(oldSchema);
            node.typname = newSchema + '.' + typeName;
            result.schemasTransformed.set(oldSchema, newSchema);
            break;
          }
        }
      }
    },
    
    PLpgSQL_var: (path: any) => {
      const node = path.node;
      if (node.refname) {
        for (const [oldSchema, newSchema] of schemaMap.entries()) {
          if (node.refname.startsWith(oldSchema + '.')) {
            const rest = node.refname.substring(oldSchema.length + 1);
            result.schemasFound.add(oldSchema);
            node.refname = newSchema + '.' + rest;
            result.schemasTransformed.set(oldSchema, newSchema);
            break;
          }
        }
      }
    },
  };
}

/**
 * Transform a PLpgSQL_type typname using proper AST parsing.
 */
export function transformPlpgsqlTypeAst(
  typname: string,
  schemaMapping: SchemaMappingInput,
  result: SchemaTransformResult
): string {
  const schemaMap = schemaLevelMap(schemaMapping);
  let suffix = '';
  let baseTypname = typname;
  
  const rowtypeMatch = typname.match(/(%rowtype|%type)$/i);
  if (rowtypeMatch) {
    suffix = rowtypeMatch[1];
    baseTypname = typname.substring(0, typname.length - suffix.length);
  }
  
  let needsTransform = false;
  for (const oldSchema of schemaMap.keys()) {
    if (baseTypname.startsWith(oldSchema + '.') || baseTypname.startsWith('"' + oldSchema + '".')) {
      needsTransform = true;
      break;
    }
  }
  
  if (!needsTransform) {
    return typname;
  }
  
  try {
    const sql = `SELECT NULL::${baseTypname}`;
    const parseResult = parseSql(sql);
    
    if (!parseResult?.stmts?.[0]?.stmt) {
      return transformPlpgsqlTypeString(typname, schemaMapping, result);
    }
    
    const sqlVisitor = {
      TypeName: (path: any) => {
        const typeNode = path.node;
        if (typeNode.names && Array.isArray(typeNode.names)) {
          transformNameList(typeNode.names, schemaMapping, result, 'type');
        }
      }
    };
    
    walkSqlAst(parseResult.stmts[0].stmt, sqlVisitor);
    
    const deparsed = Deparser.deparse(parseResult.stmts[0].stmt);
    
    const match = deparsed.match(/SELECT\s+NULL::(.+)/i);
    if (match) {
      const transformedTypname = match[1].trim().replace(/;$/, '');
      return transformedTypname + suffix;
    }
    
    return transformPlpgsqlTypeString(typname, schemaMapping, result);
  } catch {
    return transformPlpgsqlTypeString(typname, schemaMapping, result);
  }
}

/**
 * Fallback string-based transformation for PLpgSQL_type typname.
 * Uses @pgsql/quotes QuoteUtils for proper identifier quoting.
 */
export function transformPlpgsqlTypeString(
  typname: string,
  schemaMapping: SchemaMappingInput,
  result: SchemaTransformResult
): string {
  for (const [oldSchema, newSchema] of schemaLevelMap(schemaMapping).entries()) {
    // Unquoted schema: old_schema.rest
    if (typname.startsWith(oldSchema + '.')) {
      const rest = typname.substring(oldSchema.length + 1);
      result.schemasFound.add(oldSchema);
      result.schemasTransformed.set(oldSchema, newSchema);
      return QuoteUtils.quoteIdentifier(newSchema) + '.' + rest;
    }
    // Quoted schema: "old_schema".rest
    if (typname.startsWith('"' + oldSchema + '".')) {
      const rest = typname.substring(oldSchema.length + 3);
      result.schemasFound.add(oldSchema);
      result.schemasTransformed.set(oldSchema, newSchema);
      return QuoteUtils.quoteIdentifier(newSchema) + '.' + rest;
    }
  }
  return typname;
}

/**
 * Recursively walk the PL/pgSQL AST to transform schema names.
 */
export function walkPlpgsqlForSchemas(
  node: any,
  schemaMapping: SchemaMappingInput,
  result: SchemaTransformResult
): void {
  if (node === null || node === undefined || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      walkPlpgsqlForSchemas(node[i], schemaMapping, result);
    }
    return;
  }

  // Fallback for SQL expressions the plpgsql walker does not reach with the
  // SQL visitor (e.g. statements inside EXCEPTION handler bodies). The
  // deparser renders exprs from their query string, so rewriting mapped
  // schema-followed-by-dot references here is safe and idempotent.
  if ('PLpgSQL_expr' in node) {
    const expr = node.PLpgSQL_expr;
    if (typeof expr.query === 'string' && expr.query.includes('.')) {
      expr.query = transformSchemaRefsInString(expr.query, schemaMapping, result);
    } else if (expr.query && typeof expr.query === 'object' && expr.query.kind === 'sql-stmt') {
      // Hydrated exprs carry { original, parseResult }; the deparser renders
      // from parseResult, so visit its statements with the SQL visitor.
      const sqlVisitor = createSqlVisitor(schemaMapping, result);
      if (Array.isArray(expr.query.parseResult?.stmts)) {
        for (const stmt of expr.query.parseResult.stmts) {
          if (stmt?.stmt) {
            walkSqlAst(stmt.stmt, sqlVisitor);
          }
        }
      }
      if (typeof expr.query.original === 'string' && expr.query.original.includes('.')) {
        expr.query.original = transformSchemaRefsInString(expr.query.original, schemaMapping, result);
      }
    }
  }

  // Transform schema-qualified references inside RAISE message strings
  if ('PLpgSQL_stmt_raise' in node) {
    const raise = node.PLpgSQL_stmt_raise;
    if (typeof raise.message === 'string' && raise.message.includes('.')) {
      raise.message = transformSchemaRefsInString(raise.message, schemaMapping, result);
    }
  }

  if ('PLpgSQL_type' in node) {
    const plType = node.PLpgSQL_type;
    if (plType.typname) {
      if (typeof plType.typname === 'object' && plType.typname.kind === 'type-name') {
        // Transform schema names directly in the typeNameNode.names array.
        // We cannot use walkSqlAst here because the raw typeNameNode is not
        // wrapped in the expected AST envelope that the traverse walker needs.
        if (plType.typname.typeNameNode?.names) {
          transformNameList(plType.typname.typeNameNode.names, schemaMapping, result, 'type');
        }
        // The deparser can fall back to the 'original' string to render
        // DECLARE types, so update it as well. Rewrite only the schema
        // prefix within the string so array bounds ([]) and %rowtype/%type
        // suffixes are preserved.
        if (typeof plType.typname.original === 'string') {
          plType.typname.original = transformPlpgsqlTypeString(
            plType.typname.original,
            schemaMapping,
            result
          );
        }
      } else if (typeof plType.typname === 'string') {
        plType.typname = transformPlpgsqlTypeAst(
          plType.typname,
          schemaMapping,
          result
        );
      }
    }
  }

  for (const value of Object.values(node)) {
    walkPlpgsqlForSchemas(value, schemaMapping, result);
  }
}

/**
 * Rewrite a `LANGUAGE sql` function-body string using the full AST visitor so
 * object-level routes reach references inside the body (the body is an opaque
 * String node the outer walker never parses). Parses each statement, walks it
 * with the router-aware SQL visitor, and deparses. Falls back to the
 * schema-level string pass for anything that does not parse standalone (e.g.
 * PL/pgSQL blocks or C symbol names).
 */
function transformSqlBodyString(
  body: string,
  router: SchemaRouter,
  result: SchemaTransformResult
): string {
  try {
    const parseResult = parseSql(body);
    const stmts: any[] = parseResult?.stmts ?? [];
    if (stmts.length === 0) {
      return body.includes('.') ? transformSchemaRefsInString(body, router, result) : body;
    }
    const visitor = createSqlVisitor(router, result);
    const pieces: string[] = [];
    for (const stmt of stmts) {
      if (!stmt?.stmt) continue;
      walkSqlAst(stmt.stmt, visitor);
      pieces.push(Deparser.deparse(stmt.stmt));
    }
    return pieces.join(';\n');
  } catch {
    return body.includes('.') ? transformSchemaRefsInString(body, router, result) : body;
  }
}

/**
 * Apply schema renaming to a hydrated parse context: every top-level statement
 * and every hydrated PL/pgSQL body in one walk. `walkPlpgsqlForSchemas` handles
 * what the SQL visitor cannot see — PL/pgSQL-only nodes such as declared
 * variable types, which carry schema-qualified names as plain strings.
 */
function transformSchemasInContext(
  ctx: any,
  schemaMapping: SchemaMappingInput,
  result: SchemaTransformResult,
  visitorOptions?: { assumeSchemasExist?: Set<string> }
): void {
  walk(ctx, createSqlVisitor(schemaMapping, result, visitorOptions));

  for (const fn of ctx.functions ?? []) {
    if (fn.plpgsql?.hydrated) {
      walkPlpgsqlForSchemas(fn.plpgsql.hydrated, schemaMapping, result);
    }
  }
}

/**
 * Escape a string for use in a regular expression
 */
export function escapeRegexp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract pgpm header comments from the beginning of SQL content.
 */
export function extractPgpmHeader(content: string): { header: string; body: string } {
  const lines = content.split('\n');
  let headerEndIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed === '') {
      headerEndIndex = i + 1;
      continue;
    }
    
    if (trimmed === '--') {
      headerEndIndex = i + 1;
      continue;
    }
    
    if (trimmed.startsWith('-- Deploy') ||
        trimmed.startsWith('-- Revert') ||
        trimmed.startsWith('-- Verify') ||
        trimmed.startsWith('-- requires:') ||
        trimmed.startsWith('-- made with')) {
      headerEndIndex = i + 1;
      continue;
    }
    
    if (trimmed.startsWith('--')) {
      headerEndIndex = i + 1;
      continue;
    }
    
    // psql meta-command guard emitted by pgpm package exports, e.g.
    // \echo Use "CREATE EXTENSION foo" to load this file. \quit
    if (trimmed.startsWith('\\echo')) {
      headerEndIndex = i + 1;
      continue;
    }
    
    break;
  }
  
  const headerLines = lines.slice(0, headerEndIndex);
  const bodyLines = lines.slice(headerEndIndex);
  
  return {
    header: headerLines.join('\n') + (headerLines.length > 0 ? '\n' : ''),
    body: bodyLines.join('\n')
  };
}

/**
 * Transform comment headers (-- Deploy:, -- requires:, etc.)
 * These are not part of the SQL AST, so we use regexp for these.
 */
export function transformComments(
  content: string,
  schemaMapping: Map<string, string>,
  result: SchemaTransformResult
): string {
  const commentPattern = /^(-- (?:Deploy|requires|Revert|Verify):?\s*)(.*)$/gm;
  
  const schemas = Array.from(schemaMapping.keys()).sort((a, b) => b.length - a.length);
  
  return content.replace(commentPattern, (match, prefix, pathPart) => {
    let newPath = pathPart;
    
    for (const schema of schemas) {
      const newName = schemaMapping.get(schema);
      if (!newName) continue;
      
      result.schemasFound.add(schema);
      
      const pathPattern = new RegExp(`(schemas/)${escapeRegexp(schema)}(/|$)`, 'g');
      const before = newPath;
      newPath = newPath.replace(pathPattern, `$1${newName}$2`);
      
      if (newPath !== before) {
        result.schemasTransformed.set(schema, newName);
      }
    }
    
    return prefix + newPath;
  });
}

/**
 * Transform verify function calls that use string literals.
 * These are inside SQL strings and not part of the main AST.
 */
export function transformVerifyCalls(
  content: string,
  schemaMapping: Map<string, string>,
  result: SchemaTransformResult
): string {
  const schemas = Array.from(schemaMapping.keys()).sort((a, b) => b.length - a.length);
  
  let newContent = content;
  
  for (const schema of schemas) {
    const newName = schemaMapping.get(schema);
    if (!newName) continue;
    
    const escapedSchema = escapeRegexp(schema);
    
    const verifyPattern = new RegExp(
      `(verify_(?:function|table|trigger|type|domain|view|index|constraint|schema|policy|table_grant|function_grant|sequence_grant|type_grant)\\s*\\(\\s*')${escapedSchema}(\\.|'\\s*\\))`,
      'gi'
    );
    
    const before = newContent;
    newContent = newContent.replace(verifyPattern, `$1${newName}$2`);
    
    if (newContent !== before) {
      result.schemasFound.add(schema);
      result.schemasTransformed.set(schema, newName);
    }
  }
  
  return newContent;
}

/**
 * Transform schema names inside JSON/JSONB string values.
 */
export function transformJsonStringValues(
  content: string,
  schemaMapping: Map<string, string>,
  result: SchemaTransformResult
): string {
  const schemas = Array.from(schemaMapping.keys()).sort((a, b) => b.length - a.length);
  
  let newContent = content;
  
  for (const schema of schemas) {
    const newName = schemaMapping.get(schema);
    if (!newName) continue;
    
    const escapedSchema = escapeRegexp(schema);
    
    const jsonValuePattern = new RegExp(
      `(:")${escapedSchema}(")`,
      'g'
    );
    
    const before = newContent;
    newContent = newContent.replace(jsonValuePattern, `$1${newName}$2`);
    
    if (newContent !== before) {
      result.schemasFound.add(schema);
      result.schemasTransformed.set(schema, newName);
    }
  }
  
  return newContent;
}

/**
 * Transform a single SQL string using full AST-based transformation.
 *
 * This is the main entry point for transforming SQL content. It:
 * 1. Runs any user-supplied pre-passes (string-level)
 * 2. Extracts pgpm header comments and transforms them
 * 3. Runs full AST transformation on the SQL body
 * 4. Runs any user-supplied post-passes (string-level)
 * 5. Validates no untransformed schema names remain
 * 6. Returns the combined result
 *
 * App-specific string-level transforms (verify calls, JSON values, etc.)
 * are NOT included by default — pass them via `options.pre_passes` or
 * `options.post_passes`.  The built-in passes `transform_verify_calls`
 * and `transform_json_string_values` are exported for convenience.
 */
export function transformSql(
  content: string,
  schemaMapping: SchemaMappingInput,
  options?: TransformSqlOptions | SchemaTransformResult,
  result?: SchemaTransformResult
): { content: string; result: SchemaTransformResult } {
  // Support legacy signature: transform_sql(content, mapping, result?)
  let opts: TransformSqlOptions = {};
  let r: SchemaTransformResult;
  if (options && 'schemasFound' in options) {
    // Called with legacy signature: (content, mapping, result)
    r = options as SchemaTransformResult;
  } else {
    opts = (options as TransformSqlOptions) || {};
    r = result || createResult();
  }

  if (schemaMapping.size === 0) {
    return { content, result: r };
  }

  // String-level passes operate on whole schemas; give them the flat view.
  const passMap = schemaLevelMap(schemaMapping);
  let newContent = content;

  // Run pre-passes (app-specific string-level transforms)
  if (opts.prePasses) {
    for (const pass of opts.prePasses) {
      newContent = pass(newContent, passMap, r);
    }
  }

  // Main pass: AST transformation with header handling
  newContent = transformSqlContentAst(newContent, schemaMapping, r, opts);

  // Run post-passes (app-specific string-level transforms)
  if (opts.postPasses) {
    for (const pass of opts.postPasses) {
      newContent = pass(newContent, passMap, r);
    }
  }

  return { content: newContent, result: r };
}

/**
 * Transform a single SQL statement string using AST.
 * Unlike transform_sql, this does NOT handle headers, verify calls, or JSON values.
 * Use this for testing individual SQL statements.
 */
export function transformSqlStatement(
  sql: string,
  schemaMapping: SchemaMappingInput,
  result?: SchemaTransformResult
): { sql: string; result: SchemaTransformResult } {
  const r = result || createResult();
  
  if (schemaMapping.size === 0) {
    return { sql, result: r };
  }

  try {
    const transformed = transformSync(sql, (ctx) => {
      transformSchemasInContext(ctx, schemaMapping, r);
    }, { hydrate: true, pretty: true });

    return { sql: transformed, result: r };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    r.errors.push({ file: 'inline', error: errMsg });
    throw error;
  }
}

/**
 * Internal: Transform SQL content with header extraction and AST transformation.
 */
function transformSqlContentAst(
  content: string,
  schemaMapping: SchemaMappingInput,
  result: SchemaTransformResult,
  options?: TransformSqlOptions
): string {
  if (schemaMapping.size === 0) {
    return content;
  }

  const roundTrip = options?.roundTrip;
  const assumeSchemasExist = options?.assumeSchemasExist?.length
    ? new Set(options.assumeSchemasExist)
    : undefined;

  const { header, body } = extractPgpmHeader(content);
  
  let transformedHeader = header;
  if (header.length > 0) {
    // Header/path rewrites (-- Deploy: schemas/<schema>/...) are whole-schema.
    transformedHeader = transformComments(header, schemaLevelMap(schemaMapping), result);
  }
  
  let transformedBody = body;

  if (options?.qualifyUnqualified && transformedBody.trim().length > 0) {
    try {
      transformedBody = qualifyUnqualified(transformedBody, options.qualifyUnqualified).sql;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({ file: 'inline', error: errMsg });
      throw error;
    }
  }

  if (transformedBody.trim().length > 0) {
    let before: CapturedAsts | undefined;
    try {
      transformedBody = transformSync(transformedBody, (ctx) => {
        transformSchemasInContext(ctx, schemaMapping, result, { assumeSchemasExist });

        if (roundTrip) {
          before = captureTransformAsts(ctx);
        }
      }, { hydrate: true, pretty: true });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({ file: 'inline', error: errMsg });
      throw error;
    }
    
    validateNoUntransformedSchemas(transformedBody, schemaMapping);

    if (roundTrip && before) {
      try {
        validateRoundTrip(before, transformedBody);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        result.errors.push({ file: 'inline', error: errMsg });
        throw error;
      }
    }
  }
  
  return transformedHeader + transformedBody;
}
