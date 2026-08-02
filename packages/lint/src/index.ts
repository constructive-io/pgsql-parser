/**
 * `@pgsql/lint` — a source-level SQL/PL/pgSQL convention linter.
 *
 * It reasons about the *text* of a function definition — fully-qualified
 * references, `search_path` settings, `#variable_conflict`, dynamic SQL — from
 * its AST, and carries no `pg` / catalog dependency. The same engine runs over
 * a `CREATE FUNCTION` from a migration, an editor buffer, or a definition read
 * from a live catalog via `pg_get_functiondef`.
 *
 * Rules are injected as values, never discovered by npm name: build a linter
 * with `createLinter({ rules, severity })` and pass your own rules in.
 */

export type { LintOptions } from './engine';
export { lintDefinition, severityOf } from './engine';
export {
  FileFinding,
  FileReport,
  filesAdapter,
  lintFiles,
  lintSource,
  lintSqlText,
  resolveSqlFiles,
  sqlTextAdapter,
  sqlTextDefinitions
} from './file-runner';
export type { CallOptions, Linter, LinterConfig } from './linter';
export { createLinter } from './linter';
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
  LintDefinitionInput,
  LintProblem,
  LintResult,
  LintRule,
  LintRuleMeta,
  LintUnit,
  Severity,
  SeverityMap,
  SourceAdapter,
  SqlFragment,
  SuppressedProblem,
  SuppressionScope
} from './types';
export { defineRule } from './types';
