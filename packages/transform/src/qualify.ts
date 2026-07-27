/**
 * Opt-in qualification of unqualified object references.
 *
 * Handwritten SQL is typically unqualified — objects implicitly land in (and
 * resolve against) the `public` schema. The core schema transform only
 * rewrites *explicitly* qualified references, so ingesting such code into
 * named schemas needs a prior pass that pins every unqualified reference to a
 * schema first. This module provides that pass.
 *
 * Safety model: only routed names are qualified — either everything in an
 * {@link ObjectInventory} to a single schema, or per-object routes via
 * `targets`. Builtin functions (`now()`, `count(...)`), builtin types, and
 * column references are never touched because they are not routed. Names
 * defined by a CTE in the same statement are excluded even when they collide
 * with a routed relation.
 */

import { walk as walkSql } from '@pgsql/traverse';
import { Deparser, parseSql, transformSync, walk as walkPlpgsql } from 'plpgsql-parser';

import { classifyStatements } from './facts';

/** Named objects eligible for qualification, bucketed by namespace. */
export interface ObjectInventory {
  /** Tables, views, sequences — anything a RangeVar can reference. */
  relations: Set<string>;
  /** Function and procedure names. */
  functions: Set<string>;
  /** Enum/domain/range/composite type names. */
  types: Set<string>;
}

/** The objects a target schema should receive, by namespace. */
export interface QualifyTargetSelector {
  relations?: Iterable<string>;
  functions?: Iterable<string>;
  types?: Iterable<string>;
}

export interface QualifyUnqualifiedOptions {
  /**
   * Single-target form: schema to pin unqualified references to (e.g.
   * `'public'`). Mutually exclusive with `targets`.
   */
  schema?: string;
  /**
   * Names eligible for qualification (single-target form only). Defaults to
   * the objects created by the content itself ({@link collectCreatedObjects}).
   * When qualifying scripts that reference objects created elsewhere (e.g.
   * the scripts of a whole module), collect the inventory across all scripts
   * and pass it here.
   */
  inventory?: ObjectInventory;
  /**
   * Multi-target form: route specific objects to specific schemas in one
   * pass. Mutually exclusive with `schema`/`inventory`.
   *
   * ```ts
   * qualifyUnqualified(sql, {
   *   targets: {
   *     auth:   { relations: ['users'] },
   *     shop:   { relations: ['products'], functions: ['get_products'] },
   *     shared: { types: ['widget'] }
   *   }
   * });
   * ```
   *
   * Routing a name to two schemas in the same namespace is a conflict and
   * throws.
   */
  targets?: Record<string, QualifyTargetSelector>;
  /**
   * Prepend `CREATE SCHEMA IF NOT EXISTS <schema>;` for every target schema
   * the content does not already create. Useful when ingesting standalone
   * handwritten SQL whose target schemas may not exist.
   */
  injectCreateSchema?: boolean;
}

export interface QualifyResult {
  /** Count of references qualified, keyed by object name. */
  qualified: Map<string, number>;
  /** Schema each qualified object was routed to. */
  routed: Map<string, string>;
}

/** Resolved name → schema routing, by namespace. */
export interface QualifyRoutes {
  relations: Map<string, string>;
  functions: Map<string, string>;
  types: Map<string, string>;
}

const RELATION_TAGS = new Set([
  'CreateStmt',
  'ViewStmt',
  'CreateSeqStmt',
  'CreateTableAsStmt'
]);
const TYPE_TAGS = new Set([
  'CreateEnumStmt',
  'CreateDomainStmt',
  'CreateRangeStmt',
  'CompositeTypeStmt'
]);

/**
 * Collect the objects a SQL script creates, bucketed for qualification.
 * Only unqualified (schema-less) creations are collected — an explicitly
 * qualified creation already declares where it lives.
 */
export function collectCreatedObjects(sql: string): ObjectInventory {
  const inventory: ObjectInventory = {
    relations: new Set(),
    functions: new Set(),
    types: new Set()
  };
  for (const facts of classifyStatements(sql)) {
    for (const created of facts.creates) {
      if (created.schema) continue;
      if (RELATION_TAGS.has(facts.nodeTag)) {
        inventory.relations.add(created.name);
      } else if (facts.nodeTag === 'CreateFunctionStmt') {
        inventory.functions.add(created.name);
      } else if (TYPE_TAGS.has(facts.nodeTag)) {
        inventory.types.add(created.name);
      }
    }
  }
  return inventory;
}

/** Merge inventories collected from multiple scripts. */
export function mergeInventories(inventories: ObjectInventory[]): ObjectInventory {
  const merged: ObjectInventory = {
    relations: new Set(),
    functions: new Set(),
    types: new Set()
  };
  for (const inv of inventories) {
    for (const name of inv.relations) merged.relations.add(name);
    for (const name of inv.functions) merged.functions.add(name);
    for (const name of inv.types) merged.types.add(name);
  }
  return merged;
}

/** Resolve the routing table from the option forms. */
function resolveRoutes(sql: string, options: QualifyUnqualifiedOptions): QualifyRoutes {
  if (options.targets && options.schema) {
    throw new Error('qualifyUnqualified: pass either `schema` or `targets`, not both');
  }
  const routes: QualifyRoutes = {
    relations: new Map(),
    functions: new Map(),
    types: new Map()
  };
  const route = (bucket: Map<string, string>, namespace: string, name: string, schema: string): void => {
    const existing = bucket.get(name);
    if (existing && existing !== schema) {
      throw new Error(
        `qualifyUnqualified: conflicting targets for ${namespace} "${name}": ${existing} vs ${schema}`
      );
    }
    bucket.set(name, schema);
  };

  if (options.targets) {
    if (options.inventory) {
      throw new Error('qualifyUnqualified: `inventory` only applies to the `schema` form');
    }
    for (const [schema, selector] of Object.entries(options.targets)) {
      for (const name of selector.relations ?? []) route(routes.relations, 'relation', name, schema);
      for (const name of selector.functions ?? []) route(routes.functions, 'function', name, schema);
      for (const name of selector.types ?? []) route(routes.types, 'type', name, schema);
    }
    return routes;
  }

  if (!options.schema) {
    throw new Error('qualifyUnqualified: one of `schema` or `targets` is required');
  }
  const inventory = options.inventory ?? collectCreatedObjects(sql);
  for (const name of inventory.relations) routes.relations.set(name, options.schema);
  for (const name of inventory.functions) routes.functions.set(name, options.schema);
  for (const name of inventory.types) routes.types.set(name, options.schema);
  return routes;
}

function collectCteNames(stmt: any): Set<string> {
  const names = new Set<string>();
  walkSql(stmt, {
    CommonTableExpr: (path: any) => {
      if (path.node?.ctename) names.add(path.node.ctename);
    }
  });
  return names;
}

/**
 * Qualify unqualified references inside a LANGUAGE sql function body string.
 * (`AS $$...$$` is a String under the 'as' DefElem; only PL/pgSQL bodies are
 * exposed as a hydrated AST, so sql-language bodies need their own parse.)
 */
function qualifySqlBodyString(
  body: string,
  routes: QualifyRoutes,
  result: QualifyResult
): string {
  const parseResult = parseSql(body);
  const stmts: any[] = parseResult?.stmts ?? [];
  if (stmts.length === 0) return body;
  const pieces: string[] = [];
  for (const stmt of stmts) {
    if (!stmt?.stmt) continue;
    const visitor = createQualifyVisitor(
      { routes, cteNames: collectCteNames(stmt.stmt) },
      result
    );
    walkSql(stmt.stmt, visitor);
    pieces.push(Deparser.deparse(stmt.stmt));
  }
  return pieces.join(';\n');
}

function schemaStringNode(schema: string): any {
  return { String: { sval: schema } };
}

/**
 * Create a SQL AST visitor that qualifies unqualified references against a
 * routing table. Composable with the walkers used by the core transform.
 */
export function createQualifyVisitor(
  options: { routes: QualifyRoutes; cteNames?: Set<string> },
  result: QualifyResult
) {
  const { routes } = options;
  const cteNames = options.cteNames ?? new Set<string>();
  const typeSchemaOf = (name: string): string | undefined =>
    routes.types.get(name) ?? routes.relations.get(name);

  const record = (name: string, schema: string): void => {
    result.qualified.set(name, (result.qualified.get(name) ?? 0) + 1);
    result.routed.set(name, schema);
  };

  const qualifyNameList = (
    names: any[] | undefined,
    schemaOf: (name: string) => string | undefined
  ): void => {
    if (!names || names.length !== 1) return;
    const name = names[0]?.String?.sval;
    if (!name) return;
    const schema = schemaOf(name);
    if (schema) {
      names.unshift(schemaStringNode(schema));
      record(name, schema);
    }
  };

  const functionSchemaOf = (name: string): string | undefined => routes.functions.get(name);

  return {
    RangeVar: (path: any) => {
      const node = path.node;
      if (!node.schemaname && node.relname && !cteNames.has(node.relname)) {
        const schema = routes.relations.get(node.relname);
        if (schema) {
          node.schemaname = schema;
          record(node.relname, schema);
        }
      }
    },

    FuncCall: (path: any) => {
      qualifyNameList(path.node.funcname, functionSchemaOf);
    },

    CallStmt: (path: any) => {
      // The walker does not auto-recurse into CallStmt.funccall.
      if (path.node.funccall) {
        qualifyNameList(path.node.funccall.funcname, functionSchemaOf);
      }
    },

    TypeName: (path: any) => {
      qualifyNameList(path.node.names, typeSchemaOf);
    },

    CreateFunctionStmt: (path: any) => {
      const node = path.node;
      qualifyNameList(node.funcname, functionSchemaOf);
      // LANGUAGE sql bodies are opaque strings to the walker; parse and
      // qualify them separately (plpgsql bodies ride the hydrated AST walk).
      const isPlpgsql = (node.options ?? []).some(
        (opt: any) =>
          opt?.DefElem?.defname === 'language' &&
          opt.DefElem.arg?.String?.sval === 'plpgsql'
      );
      if (!isPlpgsql && Array.isArray(node.options)) {
        for (const opt of node.options) {
          if (opt?.DefElem?.defname === 'as' && opt.DefElem.arg?.List?.items) {
            for (const item of opt.DefElem.arg.List.items) {
              if (typeof item?.String?.sval === 'string') {
                try {
                  item.String.sval = qualifySqlBodyString(item.String.sval, routes, result);
                } catch {
                  // Not parseable standalone (e.g. C symbol names) — leave as-is.
                }
              }
            }
          }
        }
      }
    },

    CreateTrigStmt: (path: any) => {
      qualifyNameList(path.node.funcname, functionSchemaOf);
    },

    ObjectWithArgs: (path: any) => {
      qualifyNameList(path.node.objname, functionSchemaOf);
    },

    CreateEnumStmt: (path: any) => {
      qualifyNameList(path.node.typeName, name => routes.types.get(name));
    },

    CreateRangeStmt: (path: any) => {
      qualifyNameList(path.node.typeName, name => routes.types.get(name));
    },

    CreateDomainStmt: (path: any) => {
      qualifyNameList(path.node.domainname, name => routes.types.get(name));
    }
  };
}

/**
 * Qualify unqualified references in a SQL string.
 *
 * Two forms:
 * - `{ schema, inventory? }` — pin every inventoried name to one schema.
 * - `{ targets }` — route specific objects to specific schemas in one pass.
 *
 * Runs as a standalone AST pass (parse → qualify → deparse). To combine with
 * a schema rename, run this first (typically with `schema: 'public'`) and
 * then map via the core transform — or use the `qualifyUnqualified` option on
 * `transformSql`, which does exactly that.
 */
export function qualifyUnqualified(
  sql: string,
  options: QualifyUnqualifiedOptions
): { sql: string; result: QualifyResult } {
  const result: QualifyResult = { qualified: new Map(), routed: new Map() };
  const routes = resolveRoutes(sql, options);

  let qualified = transformSync(sql, (ctx) => {
    const stmts: any[] = ctx.sql?.stmts ?? [];

    for (const stmt of stmts) {
      if (stmt?.stmt) {
        const visitor = createQualifyVisitor(
          { routes, cteNames: collectCteNames(stmt.stmt) },
          result
        );
        walkSql(stmt.stmt, visitor);
      }
    }

    const bodyVisitor = createQualifyVisitor({ routes }, result);
    for (const fn of ctx.functions) {
      if (fn.plpgsql?.hydrated) {
        walkPlpgsql(fn.plpgsql.hydrated, {}, {
          walkSqlExpressions: true,
          sqlVisitor: bodyVisitor
        });
      }
    }
  }, { hydrate: true, pretty: true });

  if (options.injectCreateSchema) {
    const targetSchemas = new Set<string>([
      ...routes.relations.values(),
      ...routes.functions.values(),
      ...routes.types.values()
    ]);
    const created = new Set<string>();
    for (const facts of classifyStatements(qualified)) {
      if (facts.nodeTag === 'CreateSchemaStmt') {
        for (const createdSchema of facts.creates) created.add(createdSchema.name);
      }
    }
    const missing = [...targetSchemas].filter(schema => !created.has(schema)).sort();
    if (missing.length > 0) {
      const prelude = missing
        .map(schema => `CREATE SCHEMA IF NOT EXISTS ${schema};`)
        .join('\n');
      qualified = `${prelude}\n\n${qualified}`;
    }
  }

  return { sql: qualified, result };
}
