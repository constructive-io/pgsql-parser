/**
 * `createLinter` — the ecosystem entry point.
 *
 * A linter is nothing but a rule set + severities + directive keyword bound
 * together. Rules are passed *in* as values (not discovered by npm name), so
 * anyone can publish a rule package, `import` it, and add it here. Severity is
 * configuration (ESLint-style `off` / `warn` / `error`), keyed by rule id or
 * code, so a downstream consumer (safegres) keeps full control of how loud
 * each rule is without duplicating any engine logic.
 */

import { lintDefinition, LintOptions } from './engine';
import {
  FileReport,
  filesAdapter,
  lintFiles,
  lintSource,
  lintSqlText,
  sqlTextAdapter
} from './file-runner';
import { LINT_RULES } from './rules';
import { DEFAULT_KEYWORDS } from './suppressions';
import type { LintResult, LintRule, SeverityMap, SourceAdapter } from './types';

/** Configuration for a {@link Linter}. */
export interface LinterConfig {
  /** The rule set. Defaults to the built-in C1–C4. */
  rules?: LintRule[];
  /** Per-rule severity, keyed by id or code. Unmapped rules default to `error`. */
  severity?: SeverityMap;
  /** Suppression directive keyword(s). Defaults to `['pgsql-lint', 'safegres']`. */
  keyword?: string | string[];
  /** Glob patterns excluded by the file entry points (`lintFiles`). */
  ignore?: string[];
  /** Directory the `ignore` patterns are relative to (default `process.cwd()`). */
  cwd?: string;
}

/** Narrow a single call to a subset of the linter's rules. */
export type CallOptions = Pick<LintOptions, 'rules'>;

/**
 * A linter bound to a rule set, severities, and keyword. Build one with your
 * own rules and point it at definitions, SQL text, files, or a custom adapter.
 *
 * @example
 * const linter = createLinter({
 *   rules: [...LINT_RULES, noWritesInView],
 *   severity: { 'require-qualified-refs': 'warn', C2: 'off' }
 * });
 * await linter.lintFiles(['./migrations']);
 */
export interface Linter {
  readonly rules: LintRule[];
  readonly severity: SeverityMap;
  readonly keyword: string | string[];
  /** Lint one function definition (e.g. from `pg_get_functiondef`). */
  lintDefinition: (
    text: string,
    language: string,
    name?: string,
    options?: CallOptions
  ) => Promise<LintResult>;
  /** Lint a SQL source string containing any number of statements. */
  lintSqlText: (source: string, options?: CallOptions) => Promise<FileReport>;
  /** Lint every `.sql` file reachable from `paths` (files or directories). */
  lintFiles: (paths: string[], options?: CallOptions) => Promise<FileReport[]>;
  /** Lint every definition a {@link SourceAdapter} yields. */
  lintSource: (adapter: SourceAdapter, options?: CallOptions) => Promise<FileReport[]>;
}

/** Build a {@link Linter} bound to a rule set, severities, and keyword. */
export function createLinter(config: LinterConfig = {}): Linter {
  const rules = config.rules ?? LINT_RULES;
  const severity = config.severity ?? {};
  const keyword = config.keyword ?? DEFAULT_KEYWORDS;
  const { ignore, cwd } = config;
  const bind = (options: CallOptions = {}): LintOptions => ({
    ruleSet: rules,
    severity,
    keyword,
    rules: options.rules
  });
  return {
    rules,
    severity,
    keyword,
    lintDefinition: (text, language, name, options) =>
      lintDefinition(text, language, name, bind(options)),
    lintSqlText: (source, options) => lintSqlText(source, bind(options)),
    lintFiles: (paths, options) => lintFiles(paths, { ...bind(options), ignore, cwd }),
    lintSource: (adapter, options) => lintSource(adapter, bind(options))
  };
}

export { filesAdapter, sqlTextAdapter };
