/**
 * `no-dynamic-sql` (C4): a function must not use dynamic SQL.
 *
 * Dynamic SQL (`EXECUTE`, `EXECUTE … USING`, `FOR … IN EXECUTE`) is permitted
 * only for lookup-only or code-generation work, and never for writes — but the
 * string handed to `EXECUTE` is opaque to the parser, so we cannot statically
 * tell read from write. The enforceable form is therefore: flag every site,
 * and require a categorized waiver. This is the one rule whose suppression
 * must carry a reason (see `reasonRequired`), so an approved use always names
 * *why* (`lookup-only` / `codegen`).
 */

import type { LintRule } from '../types';

export const noDynamicSql: LintRule = {
  id: 'no-dynamic-sql',
  code: 'C4',
  title: 'Function must not use dynamic SQL',
  reasonRequired: true,
  run(unit) {
    return unit.dynamicSql.map((site) => ({
      ruleId: 'no-dynamic-sql',
      line: site.line,
      message: `Function uses dynamic SQL (${site.form})`,
      hint: 'Avoid dynamic SQL. If it is genuinely lookup-only or code-generation (never a write), waive it with a reason: `-- pgsql-lint-disable-next-line no-dynamic-sql -- lookup-only: <why>`.',
      context: { form: site.form }
    }));
  }
};
