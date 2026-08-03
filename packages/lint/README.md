# @pgsql/lint

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE-MIT"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
   <a href="https://www.npmjs.com/package/@pgsql/lint"><img height="20" src="https://img.shields.io/github/package-json/v/constructive-io/pgsql-parser?filename=packages%2Flint%2Fpackage.json"/></a>
</p>

A source-level SQL / PL/pgSQL **convention linter**. It reasons about the *text*
of a `CREATE FUNCTION` definition — from its AST — and carries **no `pg` /
catalog dependency**, so the exact same engine runs over a definition in a
migration, an editor buffer, a pre-commit hook, or one read from a live catalog
via `pg_get_functiondef`.

## Installation

```bash
npm install @pgsql/lint
```

## Rules

| Code | Id | Flags |
|------|----|-------|
| `C1` | `no-set-search-path` | `SET search_path` clause, or `set_config('search_path', …)` |
| `C2` | `no-variable-conflict` | a PL/pgSQL `#variable_conflict` directive |
| `C3` | `require-qualified-refs` | an unqualified relation reference (`FROM users` → `FROM app_public.users`) |
| `C4` | `no-dynamic-sql` | `EXECUTE`, `EXECUTE … USING`, `FOR … IN EXECUTE` |

The rules encode a single discipline: never depend on `search_path` — fully
qualify everything (`C1` + `C3`) — don't paper over ambiguity (`C2`), and treat
dynamic SQL as opaque and exceptional (`C4`).

## CLI

```bash
pgsql-lint path/to/migrations           # a directory (scanned recursively for .sql)
pgsql-lint schema.sql other.sql         # explicit files
pgsql-lint . --rules no-dynamic-sql     # only some rules
pgsql-lint . --warn require-qualified-refs   # downgrade to a warning (won't fail)
pgsql-lint . --off C2                        # disable a rule (by id or code)
pgsql-lint . --json                     # machine-readable
pgsql-lint . --ignore 'sql/,**/generated/**' # exclude generated trees
pgsql-lint --changed                    # only .sql that this branch touched
pgsql-lint --changed origin/main        # …against an explicit base
```

Exit code is `1` when any **error**-severity (and non-waived) finding remains,
`0` otherwise — drop it straight into CI. `--warn` findings print but don't fail.

### Changed files only

`--changed[=<base>]` lints just the `.sql` files a branch touched, so a CI gate
costs a second instead of scanning the whole tree. The base defaults to the pull
request's base branch (`$GITHUB_BASE_REF`) and otherwise to the repository's
default branch; the diff is taken against `git merge-base HEAD <base>`, so
commits landed on the base branch afterwards don't widen the set. Uncommitted and
untracked changes are included, deleted/renamed-away paths are dropped, and a
shallow clone or detached checkout (no resolvable base) falls back to working-tree
changes only. Nothing changed is an exit-0 pass.

Detection is [`git-changed`](https://npmjs.com/package/git-changed), shared with
`pgpm package --check`, so the two agree on what "changed" means.

### Config file

`.pgsqllintrc.json`, discovered by walking up from the working directory (or
passed with `--config <file>`; `--no-config` skips discovery). The keys mirror the
flags, and any flag overrides the file:

```json
{
  "extends": "./ci/lint-base.json",
  "paths": ["packages", "application/app"],
  "ignore": ["sql/", "application/constructive/", "**/generated/**"],
  "warn": ["require-qualified-refs"],
  "off": ["C2"]
}
```

`paths` supplies the default targets when none are given on the command line, so
`pgsql-lint` and `pgsql-lint --changed` need no arguments. `extends` names another
config *file* — a path relative to the file that declared it, or an npm module —
and the inheriting file wins key by key. Ignore patterns are gitignore-flavoured
globs relative to the config file's directory: `*` within a segment, `**` across
segments, a plain path excludes the whole subtree, and an unanchored pattern
matches at any segment boundary (`/` anchors it to the root).

## Suppressions

ESLint / Prettier-style comments, authored in the function body (they survive
`pg_get_functiondef`). The keyword is `pgsql-lint` (`safegres` is also accepted):

```sql
-- pgsql-lint-disable-next-line no-dynamic-sql -- lookup-only: building an IN-list of ints
EXECUTE format('SELECT … WHERE id = ANY(%L)', ids);
```

Forms: `disable-next-line`, `disable-line`, `disable` … `enable` (a range), and
`disable-file`. A directive with no rule listed applies to every rule; a reason
follows a second `--` or a `:`.

`no-dynamic-sql` **requires** a reason: a reasonless waiver does not silence it,
so an approved use always documents *why* (`lookup-only` / `codegen`). Suppressed
findings are reported as *acknowledged* accepted-risk, never dropped.

## Programmatic API

```ts
import { lintDefinition, lintFiles, lintSqlText } from '@pgsql/lint';

// one definition (e.g. from pg_get_functiondef)
const { problems, suppressed } = await lintDefinition(defText, 'plpgsql');

// a SQL source string with many statements
const report = await lintSqlText(migrationSql);

// files / directories on disk
const reports = await lintFiles(['./migrations']);
```

## Custom rules & severity (building an ecosystem)

Rules are **injected as values** — never discovered by a magic npm package name.
A rule is a plain object; publish it, `import` it, and pass it to `createLinter`.
Severity is *configuration* (ESLint-style `off` / `warn` / `error`), keyed by
rule id or code, so a consumer stays in full control of how loud each rule is:

```ts
import { createLinter, defineRule, LINT_RULES } from '@pgsql/lint';

const noWritesInView = defineRule({
  id: 'no-writes-in-view',
  code: 'X1',
  title: 'views must be read-only',
  reasonRequired: false,
  run: (unit) => [/* … inspect unit.fragments / unit.dynamicSql … */]
});

const linter = createLinter({
  rules: [...LINT_RULES, noWritesInView],
  severity: { 'require-qualified-refs': 'warn', C2: 'off' }
});

await linter.lintFiles(['./migrations']);   // also lintDefinition / lintSqlText / lintSource
```

### Source adapters

Rules are pure `unit → problems`; an **adapter** decides *where* the definitions
come from. `@pgsql/lint` ships `filesAdapter` and `sqlTextAdapter`; a consumer
(e.g. safegres, reading a live catalog via `pg_get_functiondef`) implements the
`SourceAdapter` interface and passes it to `linter.lintSource(adapter)`.

```ts
interface SourceAdapter {
  id: string;
  definitions: () => Promise<LintDefinitionInput[]> | LintDefinitionInput[];
}
```
