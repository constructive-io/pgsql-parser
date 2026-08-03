---
name: pgsql-lint
description: How to lint SQL/PL-pgSQL source with @pgsql/lint and how to author new rules, severities, and source adapters. Use when running the convention linter, adding a rule, wiring it into a tool (CLI, pre-commit, safegres), or debugging a finding.
---

# @pgsql/lint

`@pgsql/lint` (`packages/lint`) is a **source-level** convention linter: source
text in → findings out. It parses a `CREATE FUNCTION` definition, walks the AST,
and reports style/safety violations. It has **no `pg` / catalog dependency**, so
the same engine runs over a migration on disk, an editor buffer, a pre-commit
hook, or a definition read from a live catalog via `pg_get_functiondef`
(safegres consumes it exactly this way).

Runtime footprint is only the parser stack in this repo: `pgsql-parser`
(SQL → AST), `libpg-query` (`parsePlPgSQL`), `@pgsql/traverse` (`walk`).

## The built-in rules

| Code | Id | Flags | Reason required? |
|------|----|-------|------------------|
| `C1` | `no-set-search-path` | `SET search_path` clause **or** `set_config('search_path', …)` | no |
| `C2` | `no-variable-conflict` | a PL/pgSQL `#variable_conflict` directive | no |
| `C3` | `require-qualified-refs` | an unqualified relation reference (`FROM users`); CTE names excluded | no |
| `C4` | `no-dynamic-sql` | `EXECUTE`, `EXECUTE … USING`, `FOR … IN EXECUTE` | **yes** |

The discipline: never depend on `search_path` — fully qualify everything
(`C1` + `C3`); don't paper over ambiguity (`C2`); treat dynamic SQL as opaque
and exceptional (`C4`).

## Running it

```bash
pgsql-lint ./migrations                       # dir, recursive .sql
pgsql-lint schema.sql --json                  # machine-readable
pgsql-lint . --rules no-dynamic-sql           # subset
pgsql-lint . --warn require-qualified-refs    # downgrade (won't fail)
pgsql-lint . --off C2                          # disable (id or code)
pgsql-lint . --ignore 'sql/,**/generated/**'   # exclude generated trees
pgsql-lint --changed [base]                    # only .sql this branch touched
```

Exit code is `1` when any **error**-severity, non-waived finding remains, `0`
otherwise. `--warn` findings print but don't fail the run.

A repo states its policy once in `.pgsqllintrc.json` (discovered upward from cwd;
`--config <file>` / `--no-config` override discovery) with the same keys as the
flags — `rules`, `warn`, `off`, `ignore`, `keyword`, `paths`, plus `extends`
naming another config file. Flags override the file. `paths` gives the default
targets, so a CI step is just `pgsql-lint --changed`.

`--changed` diffs against `git merge-base HEAD <base>` (base: explicit →
`$GITHUB_BASE_REF` → the repository's default branch), unions in working-tree and
untracked changes, drops paths that no longer exist, and falls back to
`git diff HEAD` on a shallow/detached checkout. Modelled on pgpm's bundle-drift
check. Nothing changed → exit 0.

Programmatic entry points (all pure, DB-free):

```ts
import { lintDefinition, lintSqlText, lintFiles } from '@pgsql/lint';

await lintDefinition(defText, 'plpgsql');   // one definition (pg_get_functiondef)
await lintSqlText(migrationSql);            // a source string, many statements
await lintFiles(['./migrations']);          // files/dirs on disk
```

`lintSqlText`/`lintFiles` slice out each top-level `CREATE FUNCTION` using the
parser's `stmt_location`/`stmt_len`, lint each in isolation, and **re-anchor**
findings to absolute file lines — so a mixed migration is never treated as one
malformed definition.

## Authoring a new rule

A rule is a plain value — **no magic npm names**. Author it with `defineRule`
(type-only helper) and hand it to `createLinter`:

```ts
import { createLinter, defineRule, LINT_RULES } from '@pgsql/lint';

const noWritesInView = defineRule({
  id: 'no-writes-in-view',   // stable, ESLint-style id
  code: 'X1',                // registry code
  title: 'views must be read-only',
  reasonRequired: false,     // true ⇒ a bare suppression won't silence it
  run: (unit) => {
    // unit.fragments  — parsed SQL fragments, each with lineForOffset(offset)
    // unit.dynamicSql — detected EXECUTE / dynamic sites (line + form)
    // unit.lines      — raw source lines (1-based reporting)
    return [];               // LintProblem[] { ruleId, line, message, hint?, context? }
  }
});

const linter = createLinter({ rules: [...LINT_RULES, noWritesInView] });
await linter.lintFiles(['./migrations']);
```

Rule bodies must use `walk` from `@pgsql/traverse` (via the package's `findAll`
helper) — never hand-roll a `transformSync(..., { hydrate: true })` loop. See the
`ast-traversal` skill.

### Severity is config, not rule state

Severity (`off` / `warn` / `error`, ESLint-style) is decided by the *consumer*,
keyed by rule id or code; a rule never hard-codes its own severity. Unmapped
rules default to `error`; `off` rules don't run.

```ts
createLinter({ severity: { 'require-qualified-refs': 'warn', C2: 'off' } });
```

This is the safegres seam: its registry maps `high/medium/low` → `error/warn/off`
and passes a `severity` map in — no duplicated severity logic downstream.

### Source adapters — where definitions come from

A rule is pure `unit → problems`; an **adapter** decides *where* definitions come
from. The package ships `filesAdapter` and `sqlTextAdapter`; a consumer
implements `SourceAdapter` and calls `linter.lintSource(adapter)`:

```ts
interface SourceAdapter {
  id: string;
  definitions: () => Promise<LintDefinitionInput[]> | LintDefinitionInput[];
}
```

safegres is "the catalog adapter": it yields `LintDefinitionInput`s from
`pg_get_functiondef`, over the same engine and rules.

## Suppressions

ESLint/Prettier-style, authored in the function body (they survive
`pg_get_functiondef`). Keywords `pgsql-lint` and `safegres` are both accepted:

```sql
-- pgsql-lint-disable-next-line no-dynamic-sql -- lookup-only: building an IN-list of ints
EXECUTE format('SELECT … WHERE id = ANY(%L)', ids);
```

Forms: `disable-next-line`, `disable-line`, `disable`…`enable` (range),
`disable-file`. `no-dynamic-sql` **requires** a reason — a reasonless waiver does
not silence it (the finding stands, tagged `invalidSuppression: 'missing-reason'`).
Suppressed findings are reported as *acknowledged* accepted-risk, never dropped.

## Files

| File | What |
|------|------|
| `src/engine.ts` | `lintDefinition` — parse, run rules, apply suppressions, attach severity |
| `src/linter.ts` | `createLinter` — bind a rule set + severities + keyword; `lintDefinition`/`lintSqlText`/`lintFiles`/`lintSource` |
| `src/file-runner.ts` | file/sql-text slicing + re-anchoring; `filesAdapter`, `sqlTextAdapter`, `lintSource` |
| `src/rules/*` | the built-in C1–C4 rules |
| `src/suppressions.ts` | the ESLint/Prettier-style directive parser |
| `src/parse-unit.ts` | `CREATE FUNCTION` → `LintUnit` (SQL + PL/pgSQL bodies) |
| `src/changed.ts` | `--changed` — merge-base + working-tree changed-file detection |
| `src/config.ts` | `.pgsqllintrc.json` discovery, `extends`, key validation |
| `src/ignore.ts` | `--ignore` gitignore-flavoured glob matching |
| `src/cli.ts` | the `pgsql-lint` CLI |
| `src/types.ts` | public types + `defineRule` |
