/**
 * The lint engine: parse a definition, run the rules, then apply suppressions.
 * Pure `source → result`, with no `pg` dependency, so it can be unit-tested on
 * string literals and embedded anywhere.
 *
 * Rules and their severities are *injected*, never discovered by name: you pass
 * the rule objects in (see `createLinter`), so a third-party rule ships as an
 * ordinary import, not a magic `pgsql-lint-plugin-*` package.
 */

import { parseUnit } from './parse-unit';
import { LINT_RULES } from './rules';
import { DEFAULT_KEYWORDS, Suppressions } from './suppressions';
import type {
  LintProblem,
  LintResult,
  LintRule,
  Severity,
  SeverityMap,
  SuppressedProblem
} from './types';

export interface LintOptions {
  /** Restrict to these rule ids/codes; omit to run every rule in the set. */
  rules?: string[];
  /**
   * The rule set to draw from. Defaults to the built-ins. Pass your own array
   * (built-ins spread in plus custom rules) to extend the linter.
   */
  ruleSet?: LintRule[];
  /** Per-rule severity, keyed by id or code. Unmapped rules default to `error`. */
  severity?: SeverityMap;
  /**
   * Directive keyword(s) recognised in suppression comments. Defaults to
   * `['pgsql-lint', 'safegres']`.
   */
  keyword?: string | string[];
}

/** Resolve a rule's configured severity (id wins over code; default `error`). */
export function severityOf(rule: LintRule, severity: SeverityMap = {}): Severity {
  return severity[rule.id] ?? severity[rule.code] ?? 'error';
}

/** Lint a single function definition. */
export async function lintDefinition(
  text: string,
  language: string,
  name?: string,
  options: LintOptions = {}
): Promise<LintResult> {
  const active: LintProblem[] = [];
  const suppressed: SuppressedProblem[] = [];

  const severity = options.severity ?? {};
  let selected = options.ruleSet ?? LINT_RULES;
  if (options.rules) {
    const wanted = new Set(options.rules);
    selected = selected.filter((r) => wanted.has(r.id) || wanted.has(r.code));
  }
  // `off` rules never run.
  selected = selected.filter((r) => severityOf(r, severity) !== 'off');
  if (selected.length === 0) return { problems: active, suppressed };

  const unit = await parseUnit(text, language, name);
  // An unparseable definition produces no lint findings — dynamic/opaque bodies
  // are a downstream concern (e.g. a call-graph), not the linter's.
  if (unit.parseError) return { problems: active, suppressed };

  const keywords = options.keyword
    ? (Array.isArray(options.keyword) ? options.keyword : [options.keyword])
    : DEFAULT_KEYWORDS;
  const suppressions = new Suppressions(unit.lines, keywords);

  for (const rule of selected) {
    const sev = severityOf(rule, severity);
    for (const problem of rule.run(unit)) {
      const p: LintProblem = { ...problem, severity: sev };
      const res = suppressions.resolve(p.ruleId, p.line, rule.reasonRequired);
      if (res.suppressed) {
        suppressed.push({ ...p, reason: res.reason ?? null, scope: res.scope });
        continue;
      }
      if (res.invalidMissingReason) {
        active.push({
          ...p,
          message: `${p.message} (suppression ignored: a reason is required)`,
          context: { ...p.context, invalidSuppression: 'missing-reason' }
        });
        continue;
      }
      active.push(p);
    }
  }

  active.sort((a, b) => a.line - b.line || a.ruleId.localeCompare(b.ruleId));
  return { problems: active, suppressed };
}
