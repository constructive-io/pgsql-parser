/**
 * Object identity — the canonical, Postgres-native answer to "what object is
 * this statement about?".
 *
 * Identity is the key used by dependency graphs, semantic diffing, and any
 * downstream naming scheme. It is a pure function of classifier facts —
 * grounded in the parser's node taxonomy (`CreateStmt`, `CreateTrigStmt`,
 * `IndexStmt`, ...), never in surface syntax like RangeVars. Rendering an
 * identity to a change path (e.g. a pgpm module layout) is deliberately NOT
 * defined here: paths are derived projections that belong to whichever
 * packaging layer consumes the identity, so nothing is ever attached to them.
 *
 * Identity tuple: `(kind, schema, name, table?)` — `table` scopes objects
 * that are only unique per table (triggers, policies, indexes, constraints,
 * seed data). Function overloads share an identity for now (signature
 * disambiguation is a planned refinement).
 */
import { StatementFacts } from './facts';

/** The kinds of objects an identity can describe. */
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
 * The identity of a database object. Identity is the diff/dependency key;
 * any path or name is only a downstream rendering of it.
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
