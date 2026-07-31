# @pgsql/scripts

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

Migration script generation for PostgreSQL: derive **revert** and **verify** scripts from the classified statement facts of a deploy script (`classifyStatements` in `@pgsql/transform`).

```ts
import { classifyStatements } from '@pgsql/transform';
import { revertFor, verifyFor } from '@pgsql/scripts';
import { loadModule } from 'plpgsql-parser';

await loadModule();
const facts = classifyStatements(deploySql);

const { sql: revertSql, warnings } = revertFor(facts);
const { sql: verifySql } = verifyFor(facts);
```

- `revertFor(facts)` — mechanical inverses in **reverse topological order** of the statement dependency graph, so dependents are dropped before their dependencies and no `CASCADE` is ever needed. Inverses are built as AST nodes and deparsed (`pgsql-deparser`), never string-templated.
- `verifyFor(facts)` — one existence check per created object, each raising on failure via `SELECT 1/(CASE WHEN <exists> THEN 1 ELSE 0 END);`.

Nothing outside the supported vocabulary is ever guessed at: `revertFor` emits a `-- revert not derivable: <reason>` comment plus a warning; `verifyFor` emits nothing plus a warning. The list is exported as `SUPPORTED_STATEMENTS` (and `SUPPORTED_NODE_TAGS`).

## Supported statements

| Statement | Revert | Verify |
|---|---|---|
| `CREATE SCHEMA` | `DROP SCHEMA` | `information_schema.schemata` |
| `CREATE TABLE` | `DROP TABLE` | `to_regclass` |
| `CREATE VIEW` | `DROP VIEW` | `to_regclass` |
| `CREATE INDEX` | `DROP INDEX` | `to_regclass` |
| `CREATE SEQUENCE` | `DROP SEQUENCE` | `to_regclass` |
| `CREATE TYPE` (composite, enum, range) | `DROP TYPE` | `to_regtype` |
| `CREATE DOMAIN` | `DROP DOMAIN` | `to_regtype` |
| `CREATE FUNCTION` / `PROCEDURE` | `DROP FUNCTION` / `PROCEDURE` with input signature (overload safe) | `to_regprocedure` |
| `CREATE TRIGGER` | `DROP TRIGGER ... ON table` | `pg_trigger` |
| `CREATE POLICY` | `DROP POLICY ... ON table` | `pg_policies` |
| `CREATE EXTENSION` | `DROP EXTENSION` | `pg_extension` |
| `CREATE ROLE` | `DROP ROLE` | `pg_roles` |
| `ALTER TABLE ... ADD COLUMN` | `DROP COLUMN` | `information_schema.columns` |
| `ALTER TABLE ... ADD CONSTRAINT` (named) | `DROP CONSTRAINT` | `information_schema.table_constraints` |
| `ALTER TABLE ... ENABLE / FORCE ROW LEVEL SECURITY` | `DISABLE` / `NO FORCE` | `pg_class.relrowsecurity` / `relforcerowsecurity` |
| `GRANT` privileges (tables, sequences, functions, schemas) | `REVOKE` same privileges | `has_table_privilege` / `has_function_privilege` / `has_schema_privilege` |
| `GRANT role TO role` | `REVOKE role FROM role` | `pg_auth_members` |
| `COMMENT ON` | `COMMENT ON ... IS NULL` | — |
| `CREATE MATERIALIZED VIEW` / `CREATE TABLE AS` | `DROP MATERIALIZED VIEW` / `DROP TABLE` | `to_regclass` |
| `CREATE SERVER` | `DROP SERVER` | `pg_foreign_server` |
| `CREATE FOREIGN TABLE` | `DROP FOREIGN TABLE` | `to_regclass` |
| `CREATE USER MAPPING` | `DROP USER MAPPING` | `pg_user_mappings` |
| `CREATE COLLATION` | `DROP COLLATION` | `pg_collation` |
| `CREATE AGGREGATE` | `DROP AGGREGATE` with input signature | `to_regprocedure` |
| `CREATE OPERATOR` (binary) | `DROP OPERATOR (left, right)` | `to_regoperator` |
| `CREATE CAST` | `DROP CAST (source AS target)` | `pg_cast` |
| `CREATE PUBLICATION` | `DROP PUBLICATION` | `pg_publication` |
| `CREATE SUBSCRIPTION` | `DROP SUBSCRIPTION` | `pg_subscription` |
| `CREATE STATISTICS` | `DROP STATISTICS` | `pg_statistic_ext` |
| `CREATE EVENT TRIGGER` | `DROP EVENT TRIGGER` | `pg_event_trigger` |
| `CREATE RULE` | `DROP RULE ... ON table` | `pg_rules` |
| `ALTER TYPE ... ADD VALUE` | — (Postgres has no `DROP VALUE`; warns) | `pg_enum` |
| `ALTER TABLE ... ATTACH PARTITION` | `DETACH PARTITION` | `pg_inherits` |
| `ALTER DEFAULT PRIVILEGES ... GRANT` | `ALTER DEFAULT PRIVILEGES ... REVOKE` | `pg_default_acl` + `aclexplode` |
| `SECURITY LABEL` | `SECURITY LABEL ... IS NULL` | — |

Not derivable (warned, never guessed): `REVOKE`, unnamed constraints, `ALTER ... SET` with unknown prior value, arbitrary DML, dynamic SQL, prefix operators.
