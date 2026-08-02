/**
 * The lint engine: parse a definition, run the rules, then apply suppressions.
 * Pure `source → result`, with no `pg` dependency, so it can be unit-tested on
 * string literals and embedded anywhere.
 */

import { parseUnit } from './parse-unit';
import { LINT_RULES, LINT_RULES_BY_ID } from './rules';
import { DEFAULT_KEYWORDS, Suppressions } from './suppressions';
import type { LintProblem, LintResult, LintRule, SuppressedProblem } from './types';

export interface LintOptions {
  /** Restrict to these rule ids; omit to run all. */
  rules?: string[];
  /**
   * Directive keyword(s) recognised in suppression comments. Defaults to
   * `['pgsql-lint', 'safegres']`. A consumer that wants only its own brand
   * (e.g. `['safegres']`) can narrow it here.
   */
  keyword?: string | string[];
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

  const selected: LintRule[] = options.rules
    ? options.rules.map((id) => LINT_RULES_BY_ID.get(id)).filter((r): r is LintRule => Boolean(r))
    : LINT_RULES;
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
    for (const problem of rule.run(unit)) {
      const res = suppressions.resolve(problem.ruleId, problem.line, rule.reasonRequired);
      if (res.suppressed) {
        suppressed.push({ ...problem, reason: res.reason ?? null, scope: res.scope });
        continue;
      }
      if (res.invalidMissingReason) {
        active.push({
          ...problem,
          message: `${problem.message} (suppression ignored: a reason is required)`,
          context: { ...problem.context, invalidSuppression: 'missing-reason' }
        });
        continue;
      }
      active.push(problem);
    }
  }

  active.sort((a, b) => a.line - b.line || a.ruleId.localeCompare(b.ruleId));
  return { problems: active, suppressed };
}
