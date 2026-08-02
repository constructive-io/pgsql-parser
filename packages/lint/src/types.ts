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

/** A single lint finding, before suppressions are applied. */
export interface LintProblem {
  ruleId: string;
  /** Absolute line (1-based) within the definition. */
  line: number;
  message: string;
  hint?: string;
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
