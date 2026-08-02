/**
 * `no-variable-conflict` (C2): a PL/pgSQL body must not use a
 * `#variable_conflict` directive.
 *
 * The directive papers over an ambiguity between a column name and a PL/pgSQL
 * variable; the house style is to remove the ambiguity (rename the variable,
 * qualify the column) rather than declare a winner. The directive is a
 * compiler pragma that must start a line at the top of the body, so a line
 * scan is exact — it never appears inside an expression or string.
 */

import type { LintRule } from '../types';

const RE = /^\s*#variable_conflict\b\s*(\S+)?/i;

export const noVariableConflict: LintRule = {
  id: 'no-variable-conflict',
  code: 'C2',
  title: 'Function must not use #variable_conflict',
  reasonRequired: false,
  run(unit) {
    if (unit.language.toLowerCase() !== 'plpgsql') return [];
    const out = [];
    for (let i = 0; i < unit.lines.length; i++) {
      const m = RE.exec(unit.lines[i]);
      if (!m) continue;
      const mode = m[1] ?? '';
      out.push({
        ruleId: 'no-variable-conflict',
        line: i + 1,
        message: `Function uses #variable_conflict${mode ? ` ${mode}` : ''}`,
        hint: 'Remove the directive and disambiguate explicitly: rename the variable or qualify the column reference.',
        context: { mode }
      });
    }
    return out;
  }
};
