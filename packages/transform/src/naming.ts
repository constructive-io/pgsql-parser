/**
 * PGPM naming spec v1 — canonical, derived change paths.
 *
 * A change path is never authored and never identity: it is a pure projection
 * of an object's identity through this spec. Objects (content-addressed ASTs
 * + dependency edges) are the source of truth; paths are re-derivable at any
 * time, so regrouping, renaming schemes, or repartitioning packages can never
 * break identity-keyed consumers (diff, dependency resolution).
 *
 * Identity tuple: `(kind, schema, name, table?)` — `table` scopes objects
 * that are only unique per table (triggers, policies, indexes, constraints,
 * seed data). Function overloads share a path in v1 (disambiguation via a
 * signature suffix is reserved for a future spec version).
 *
 * Canonical templates (matching the conventions used across constructive-db
 * deploy trees):
 *
 *   schema     schemas/{schema}/schema
 *   table      schemas/{schema}/tables/{table}/table
 *   trigger    schemas/{schema}/tables/{table}/triggers/{name}
 *   policy     schemas/{schema}/tables/{table}/policies/{name}
 *   index      schemas/{schema}/tables/{table}/indexes/{name}
 *   constraint schemas/{schema}/tables/{table}/constraints/{name}
 *   seed_dml   schemas/{schema}/tables/{table}/fixtures/{name}
 *   function   schemas/{schema}/procedures/{name}
 *   view       schemas/{schema}/views/{name}
 *   type       schemas/{schema}/types/{name}
 *   sequence   schemas/{schema}/sequences/{name}
 *   extension  extensions/{name}
 *   role       roles/{name}
 */
import { StatementFacts } from './facts';

/** Spec version, so bundles/modules can declare which scheme derived their paths. */
export const PGPM_NAMING_SPEC_VERSION = 1;

/** The kinds of objects the naming spec assigns paths to. */
export type ObjectIdentityKind =
  | 'schema'
  | 'extension'
  | 'role'
  | 'table'
  | 'view'
  | 'sequence'
  | 'type'
  | 'function'
  | 'index'
  | 'trigger'
  | 'policy'
  | 'constraint'
  | 'seed_dml'
  | 'other';

/**
 * The identity of a database object — what a change path is derived from.
 * Identity is the diff/dependency key; the path is only its rendering.
 */
export interface ObjectIdentity {
  kind: ObjectIdentityKind;
  /** Owning schema (`null` for non-schema objects: roles, extensions). */
  schema: string | null;
  /** Object name, unqualified (for table-scoped kinds: without the table). */
  name: string;
  /** Owning table, for objects only unique per table (trigger/policy/index/constraint/seed). */
  table?: string;
}

/** Kinds whose objects are scoped to (and only unique within) a table. */
const TABLE_SCOPED = new Set<ObjectIdentityKind>([
  'trigger',
  'policy',
  'index',
  'constraint',
  'seed_dml'
]);

/** Directory names for schema-scoped object kinds. */
const SCHEMA_DIRS: Partial<Record<ObjectIdentityKind, string>> = {
  view: 'views',
  sequence: 'sequences',
  type: 'types',
  function: 'procedures'
};

/** Directory names for table-scoped object kinds. */
const TABLE_DIRS: Partial<Record<ObjectIdentityKind, string>> = {
  trigger: 'triggers',
  policy: 'policies',
  index: 'indexes',
  constraint: 'constraints',
  seed_dml: 'fixtures'
};

/**
 * Derive the identity of the object a statement primarily creates or
 * targets, or `null` when the statement creates nothing (grants, comments —
 * such statements ride with the change of the object they attach to).
 *
 * Table-scoped kinds are recovered from the classifier's table-qualified
 * names (`table.trigger`) and, for indexes and constraints, from the
 * targeted relation.
 */
export function identityOf(facts: StatementFacts): ObjectIdentity | null {
  if (facts.kind === 'extension' && facts.extension) {
    return { kind: 'extension', schema: null, name: facts.extension.name };
  }

  const created = facts.creates[0];
  if (!created) return null;

  switch (facts.kind) {
    case 'schema':
      return { kind: 'schema', schema: null, name: created.name };
    case 'trigger':
    case 'policy': {
      const dot = created.name.indexOf('.');
      if (dot > 0) {
        return {
          kind: facts.kind,
          schema: created.schema,
          name: created.name.slice(dot + 1),
          table: created.name.slice(0, dot)
        };
      }
      return { kind: facts.kind, schema: created.schema, name: created.name };
    }
    case 'index': {
      // IndexStmt records the index name in creates and the indexed relation
      // in references (same-schema RangeVar).
      const rel = facts.references.find(r => r.schema === created.schema) ?? facts.references[0];
      return {
        kind: 'index',
        schema: created.schema,
        name: created.name,
        table: rel?.name
      };
    }
    case 'fk_constraint':
    case 'constraint':
    case 'rls_enable':
      // ALTER TABLE statements target their table.
      return { kind: 'constraint', schema: created.schema, name: created.name, table: created.name };
    case 'seed_dml':
      return { kind: 'seed_dml', schema: created.schema, name: created.name, table: created.name };
    case 'table':
      // AlterTableStmt facts also classify as `table`-targeting; the created
      // name is the table either way.
      return { kind: 'table', schema: created.schema, name: created.name };
    case 'view':
    case 'function':
    case 'type':
      return { kind: facts.kind, schema: created.schema, name: created.name };
    default:
      if (facts.nodeTag === 'CreateSeqStmt') {
        return { kind: 'sequence', schema: created.schema, name: created.name };
      }
      return { kind: 'other', schema: created.schema, name: created.name };
  }
}

/**
 * Render an identity to its canonical pgpm change path (naming spec v1).
 * Total: every identity gets a deterministic path.
 */
export function pathFor(identity: ObjectIdentity): string {
  const { kind, name } = identity;
  const schema = identity.schema ?? 'public';

  if (kind === 'schema') return `schemas/${name}/schema`;
  if (kind === 'extension') return `extensions/${name}`;
  if (kind === 'role') return `roles/${name}`;
  if (kind === 'table') return `schemas/${schema}/tables/${name}/table`;

  if (TABLE_SCOPED.has(kind)) {
    const dir = TABLE_DIRS[kind]!;
    if (identity.table && identity.table !== name) {
      return `schemas/${schema}/tables/${identity.table}/${dir}/${name}`;
    }
    // Table-scoped object whose table equals the target (ALTER TABLE
    // constraints, seed data keyed by table).
    return `schemas/${schema}/tables/${identity.table ?? name}/${dir}/${name}`;
  }

  const dir = SCHEMA_DIRS[kind];
  if (dir) return `schemas/${schema}/${dir}/${name}`;
  return `schemas/${schema}/objects/${name}`;
}

/**
 * Convenience: canonical change path for a statement, or `null` when the
 * statement has no identity of its own.
 */
export function changePathFor(facts: StatementFacts): string | null {
  const identity = identityOf(facts);
  return identity ? pathFor(identity) : null;
}
