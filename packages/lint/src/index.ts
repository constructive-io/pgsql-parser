/**
 * `@pgsql/lint` — a source-level SQL/PL/pgSQL convention linter.
 *
 * It reasons about the *text* of a function definition — fully-qualified
 * references, `search_path` settings, `#variable_conflict`, dynamic SQL — from
 * its AST, and carries no `pg` / catalog dependency. The same engine runs over
 * a `CREATE FUNCTION` from a migration, an editor buffer, or a definition read
 * from a live catalog via `pg_get_functiondef`.
 */

export type { LintOptions } from './engine';
export { lintDefinition } from './engine';
export {
  FileFinding,
  FileReport,
  lintFiles,
  lintSqlText,
  resolveSqlFiles
} from './file-runner';
export { parseUnit } from './parse-unit';
export {
  LINT_RULES,
  LINT_RULES_BY_CODE,
  LINT_RULES_BY_ID,
  noDynamicSql,
  noSetSearchPath,
  noVariableConflict,
  requireQualifiedRefs
} from './rules';
export { DEFAULT_KEYWORDS, Suppressions } from './suppressions';
export type {
  DynamicSqlSite,
  LintProblem,
  LintResult,
  LintRule,
  LintRuleMeta,
  LintUnit,
  SqlFragment,
  SuppressedProblem,
  SuppressionScope
} from './types';
