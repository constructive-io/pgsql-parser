/**
 * `require-qualified-refs` (C3): every relation reference must be
 * schema-qualified.
 *
 * Banning `SET search_path` (C1) only removes the footgun; it does not make
 * name resolution safe on its own. This is the rule that actually enforces the
 * discipline: an unqualified `FROM users` resolves against whatever
 * search_path happens to be, so it must be `FROM app_public.users`.
 *
 * v1 covers relation references (`RangeVar`). Names introduced by a CTE in the
 * same query are excluded — they are not schema objects. Unqualified *function*
 * calls are deferred (they need a built-in allowlist to avoid flagging
 * `now()`, `count()`, …).
 */

import type { LintProblem, LintRule, SqlFragment } from '../types';
import { findAll } from '../walk';

function cteNames(ast: unknown): Set<string> {
  const out = new Set<string>();
  for (const cte of findAll(ast, 'CommonTableExpr')) {
    if (typeof cte.ctename === 'string') out.add(cte.ctename);
  }
  return out;
}

function fragmentProblems(fragment: SqlFragment): LintProblem[] {
  const out: LintProblem[] = [];
  const ctes = cteNames(fragment.ast);
  const seen = new Set<string>();
  for (const rv of findAll(fragment.ast, 'RangeVar')) {
    const relname = typeof rv.relname === 'string' ? rv.relname : undefined;
    if (!relname) continue;
    if (typeof rv.schemaname === 'string' && rv.schemaname.length > 0) continue;
    if (ctes.has(relname)) continue;
    const loc = typeof rv.location === 'number' ? rv.location : -1;
    const line = fragment.lineForOffset(loc >= 0 ? loc : 0);
    const key = `${line}:${relname}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ruleId: 'require-qualified-refs',
      line,
      message: `Unqualified relation reference "${relname}"`,
      hint: 'Schema-qualify the reference (e.g. `app_public.' + relname + '`). Unqualified names resolve against search_path.',
      context: { relation: relname }
    });
  }
  return out;
}

export const requireQualifiedRefs: LintRule = {
  id: 'require-qualified-refs',
  code: 'C3',
  title: 'Relation references must be schema-qualified',
  reasonRequired: false,
  run(unit) {
    const byKey = new Map<string, LintProblem>();
    for (const fragment of unit.fragments) {
      for (const p of fragmentProblems(fragment)) {
        const key = `${p.line}:${(p.context as { relation: string }).relation}`;
        if (!byKey.has(key)) byKey.set(key, p);
      }
    }
    return [...byKey.values()].sort((a, b) => a.line - b.line);
  }
};
