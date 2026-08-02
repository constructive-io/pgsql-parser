/**
 * `no-set-search-path` (C1): a function must never set `search_path`.
 *
 * House rule: rather than pin `search_path` (the usual CWE-426 mitigation for
 * SECURITY DEFINER), we fully-qualify every reference and never touch the
 * setting at all. This flags both forms:
 *   - the declarative `CREATE FUNCTION … SET search_path = …` clause (this is
 *     exactly what `pg_proc.proconfig` / `searchPathPinned` records), and
 *   - a runtime `set_config('search_path', …)` in the body.
 */

import type { LintProblem, LintRule, LintUnit } from '../types';
import { lineOfOffset } from '../util';

function optionSites(unit: LintUnit): LintProblem[] {
  const out: LintProblem[] = [];
  const options = unit.createFnStmt?.options;
  if (!Array.isArray(options)) return out;
  for (const opt of options) {
    const de = (opt as Record<string, unknown>).DefElem as Record<string, unknown> | undefined;
    if (!de || de.defname !== 'set') continue;
    const vss = (de.arg as Record<string, unknown> | undefined)?.VariableSetStmt as
      | Record<string, unknown>
      | undefined;
    if (!vss || vss.name !== 'search_path') continue;
    const loc = typeof de.location === 'number' ? de.location : 0;
    out.push({
      ruleId: 'no-set-search-path',
      line: lineOfOffset(unit.text, loc),
      message: 'Function sets search_path',
      hint: 'Never set search_path. Fully-qualify every relation, function and type reference instead.',
      context: { form: 'SET clause' }
    });
  }
  return out;
}

function setConfigSites(unit: LintUnit): LintProblem[] {
  const out: LintProblem[] = [];
  const re = /\bset_config\s*\(\s*'search_path'/i;
  unit.lines.forEach((text, i) => {
    if (re.test(text)) {
      out.push({
        ruleId: 'no-set-search-path',
        line: i + 1,
        message: 'Function sets search_path via set_config()',
        hint: 'Never set search_path. Fully-qualify references instead of relying on it.',
        context: { form: 'set_config()' }
      });
    }
  });
  return out;
}

export const noSetSearchPath: LintRule = {
  id: 'no-set-search-path',
  code: 'C1',
  title: 'Function must not set search_path',
  reasonRequired: false,
  run(unit) {
    const byLine = new Map<number, LintProblem>();
    for (const p of [...optionSites(unit), ...setConfigSites(unit)]) {
      if (!byLine.has(p.line)) byLine.set(p.line, p);
    }
    return [...byLine.values()].sort((a, b) => a.line - b.line);
  }
};
