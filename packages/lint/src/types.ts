/**
 * Source-level SQL/PL/pgSQL linter — types.
 *
 * This package is deliberately free of any `pg` / catalog dependency: it takes
 * a function *definition* (the `CREATE FUNCTION …` text, as `pg_get_functiondef`
 * returns it, or as authored in a migration) and returns findings. Everything
 * here is decided from source text and its AST, so the linter runs the same in
 * a migration, an editor, a pre-commit hook, or a live-database auditor.
 */

/** A parsed function definition, in the coordinate space the linter reports in. */
export interface LintUnit {
  /** The full definition text — the line/column space every finding refers to. */
  text: string;
  /** `text` split on `\n`, 1-based when indexed as `lines[line - 1]`. */
  lines: string[];
  /** `sql`, `plpgsql`, `c`, `internal`, … (lower-cased `pg_proc.prolang`). */
  language: string;
  /** Display name for messages, e.g. `app.grant_role(text)`. */
  name?: string;
  /** The `CreateFunctionStmt` AST node, when the text parsed as one. */
  createFnStmt?: Record<string, unknown>;
  /** Absolute line (1-based, within `text`) the function body's first char sits on. */
  bodyStartLine?: number;
  /** Embedded SQL fragments (body statements / expressions) with a line mapper. */
  fragments: SqlFragment[];
  /** Dynamic-SQL statements found in a PL/pgSQL body, by absolute line. */
  dynamicSql: DynamicSqlSite[];
  /** True when the definition (or its body) could not be parsed. */
  parseError?: string;
}

/** One embedded SQL statement/expression, with a char-offset → absolute-line mapper. */
export interface SqlFragment {
  /** Parsed SQL AST for this fragment. */
  ast: unknown;
  /** Map a char offset within this fragment's source to an absolute line in `text`. */
  lineForOffset: (offset: number) => number;
}

export interface DynamicSqlSite {
  line: number;
  /** `EXECUTE`, `EXECUTE … USING`, or `FOR … IN EXECUTE`. */
  form: string;
}

/**
 * How loud a rule is, per project. Severity is *configuration*, not a property
 * of the rule (same model as ESLint): a rule declares only its identity, and
 * the linter config decides `off` / `warn` / `error` per rule id or code.
 *   - `off`   — the rule is not run.
 *   - `warn`  — reported, but does not fail the run.
 *   - `error` — reported and fails the run (drives a non-zero exit code).
 */
export type Severity = 'off' | 'warn' | 'error';

/** A severity per rule, keyed by rule id (`no-dynamic-sql`) or code (`C4`). */
export type SeverityMap = Record<string, Severity>;

/** A single lint finding, before suppressions are applied. */
export interface LintProblem {
  ruleId: string;
  /** Absolute line (1-based) within the definition. */
  line: number;
  message: string;
  hint?: string;
  /** Configured severity for the rule (`error` by default). */
  severity?: Severity;
  context?: Record<string, unknown>;
}

/** A problem that a suppression comment silenced — reported, never dropped. */
export interface SuppressedProblem extends LintProblem {
  /** The reason text from the directive, or null when none was given. */
  reason: string | null;
  scope: SuppressionScope;
}

export type SuppressionScope = 'next-line' | 'line' | 'range' | 'file';

/** The result of linting one definition. */
export interface LintResult {
  /** Active findings — not suppressed. */
  problems: LintProblem[];
  /** Suppressed findings, kept for the "accepted risk" report bucket. */
  suppressed: SuppressedProblem[];
}

/** Static metadata for a lint rule. */
export interface LintRuleMeta {
  /** ESLint-style stable id, e.g. `no-dynamic-sql`. */
  id: string;
  /** Registry code this rule maps to, e.g. `C4` (the `safegres:constructive` code). */
  code: string;
  title: string;
  /**
   * Whether a suppression of this rule must carry a reason. When true, a bare
   * disable directive does not suppress — the finding stands — so a waiver is
   * never silent. Only `no-dynamic-sql` requires it: it is the one rule we
   * expect to be waived (lookup-only / codegen), and the waiver's whole value
   * is the documented reason.
   */
  reasonRequired: boolean;
}

/** A lint rule: pure `unit → problems`. */
export interface LintRule extends LintRuleMeta {
  run: (unit: LintUnit) => LintProblem[];
}

/**
 * Authoring helper for third-party rules. A no-op at runtime (identity), it
 * exists only to pin the `LintRule` shape at the call site so a rule package
 * gets full type-checking without importing internals.
 *
 * @example
 * export const noWritesInView = defineRule({
 *   id: 'no-writes-in-view', code: 'X1', title: '…', reasonRequired: false,
 *   run(unit) { return []; }
 * });
 */
export function defineRule(rule: LintRule): LintRule {
  return rule;
}

/**
 * A definition to lint, as produced by a {@link SourceAdapter}. This is the
 * unit of work the engine consumes regardless of where it came from — a file,
 * a live catalog (`pg_get_functiondef`), a git diff, an editor buffer.
 */
export interface LintDefinitionInput {
  /** The full `CREATE FUNCTION …` text. */
  text: string;
  /** `sql`, `plpgsql`, … (lower-cased). */
  language: string;
  /** Display name for messages, e.g. `app.grant_role`. */
  name?: string;
  /** Origin file, when the definition came from disk. */
  file?: string;
  /**
   * Absolute 0-based line the definition begins on within `file`. Findings
   * are re-anchored by this so they point at the real file location.
   */
  startLine?: number;
}

/**
 * A source of definitions to lint. Adapters are a *different* seam from rules:
 * a rule is pure `unit → problems`, while an adapter decides *where* the
 * definitions come from. `@pgsql/lint` ships file/source adapters; safegres is
 * "the catalog adapter" over the same engine.
 */
export interface SourceAdapter {
  /** A short id for diagnostics, e.g. `files`, `sql-text`, `catalog`. */
  id: string;
  /** Yield every definition this adapter can see. */
  definitions: () => Promise<LintDefinitionInput[]> | LintDefinitionInput[];
}
