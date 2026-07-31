/**
 * The statement vocabulary supported by {@link revertFor} / {@link verifyFor}.
 *
 * Anything outside this list is never guessed at: `revertFor` emits a
 * `-- revert not derivable: <reason>` comment plus a warning, and
 * `verifyFor` emits nothing plus a warning.
 */

/** One supported statement shape and what is generated for it. */
export interface SupportedStatement {
  /** Human-readable statement shape, e.g. `CREATE TABLE`. */
  statement: string;
  /** Parser node tag(s) the shape corresponds to. */
  nodeTags: string[];
  /** What `revertFor` emits, or `null` when there is nothing to revert. */
  revert: string | null;
  /** What `verifyFor` emits, or `null` when there is nothing to verify. */
  verify: string | null;
}

export const SUPPORTED_STATEMENTS: readonly SupportedStatement[] = [
  {
    statement: 'CREATE SCHEMA',
    nodeTags: ['CreateSchemaStmt'],
    revert: 'DROP SCHEMA',
    verify: 'information_schema.schemata existence check'
  },
  {
    statement: 'CREATE TABLE',
    nodeTags: ['CreateStmt'],
    revert: 'DROP TABLE',
    verify: 'to_regclass IS NOT NULL'
  },
  {
    statement: 'CREATE VIEW',
    nodeTags: ['ViewStmt'],
    revert: 'DROP VIEW',
    verify: 'to_regclass IS NOT NULL'
  },
  {
    statement: 'CREATE INDEX',
    nodeTags: ['IndexStmt'],
    revert: 'DROP INDEX',
    verify: 'to_regclass IS NOT NULL'
  },
  {
    statement: 'CREATE SEQUENCE',
    nodeTags: ['CreateSeqStmt'],
    revert: 'DROP SEQUENCE',
    verify: 'to_regclass IS NOT NULL'
  },
  {
    statement: 'CREATE TYPE (composite, enum, range)',
    nodeTags: ['CompositeTypeStmt', 'CreateEnumStmt', 'CreateRangeStmt'],
    revert: 'DROP TYPE',
    verify: 'to_regtype IS NOT NULL'
  },
  {
    statement: 'CREATE DOMAIN',
    nodeTags: ['CreateDomainStmt'],
    revert: 'DROP DOMAIN',
    verify: 'to_regtype IS NOT NULL'
  },
  {
    statement: 'CREATE FUNCTION / PROCEDURE',
    nodeTags: ['CreateFunctionStmt'],
    revert: 'DROP FUNCTION / DROP PROCEDURE with the input signature (overload safe)',
    verify: 'to_regprocedure IS NOT NULL'
  },
  {
    statement: 'CREATE TRIGGER',
    nodeTags: ['CreateTrigStmt'],
    revert: 'DROP TRIGGER ... ON table',
    verify: 'pg_trigger existence check'
  },
  {
    statement: 'CREATE POLICY',
    nodeTags: ['CreatePolicyStmt'],
    revert: 'DROP POLICY ... ON table',
    verify: 'pg_policies existence check'
  },
  {
    statement: 'CREATE EXTENSION',
    nodeTags: ['CreateExtensionStmt'],
    revert: 'DROP EXTENSION',
    verify: 'pg_extension existence check'
  },
  {
    statement: 'CREATE ROLE',
    nodeTags: ['CreateRoleStmt'],
    revert: 'DROP ROLE',
    verify: 'pg_roles existence check'
  },
  {
    statement: 'ALTER TABLE ... ADD COLUMN',
    nodeTags: ['AlterTableStmt'],
    revert: 'ALTER TABLE ... DROP COLUMN',
    verify: 'information_schema.columns existence check'
  },
  {
    statement: 'ALTER TABLE ... ADD CONSTRAINT (named)',
    nodeTags: ['AlterTableStmt'],
    revert: 'ALTER TABLE ... DROP CONSTRAINT',
    verify: 'information_schema.table_constraints existence check'
  },
  {
    statement: 'ALTER TABLE ... ENABLE / FORCE ROW LEVEL SECURITY',
    nodeTags: ['AlterTableStmt'],
    revert: 'ALTER TABLE ... DISABLE / NO FORCE ROW LEVEL SECURITY',
    verify: 'pg_class.relrowsecurity / relforcerowsecurity check'
  },
  {
    statement: 'GRANT privileges (tables, sequences, functions, schemas)',
    nodeTags: ['GrantStmt'],
    revert: 'REVOKE the same privileges',
    verify: 'has_table_privilege / has_function_privilege / has_schema_privilege'
  },
  {
    statement: 'GRANT role TO role',
    nodeTags: ['GrantRoleStmt'],
    revert: 'REVOKE role FROM role',
    verify: 'pg_auth_members membership check'
  },
  {
    statement: 'COMMENT ON',
    nodeTags: ['CommentStmt'],
    revert: 'COMMENT ON ... IS NULL',
    verify: null
  }
];

/** Node tags with at least one supported inverse or verify derivation. */
export const SUPPORTED_NODE_TAGS: ReadonlySet<string> = new Set(
  SUPPORTED_STATEMENTS.flatMap(s => s.nodeTags)
);
