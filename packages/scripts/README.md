# @pgsql/scripts

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

Not derivable (warned, never guessed): `REVOKE`, unnamed constraints, `ALTER ... SET` with unknown prior value, arbitrary DML, dynamic SQL.
