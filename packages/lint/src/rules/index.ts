import type { LintRule } from '../types';
import { noDynamicSql } from './no-dynamic-sql';
import { noSetSearchPath } from './no-set-search-path';
import { noVariableConflict } from './no-variable-conflict';
import { requireQualifiedRefs } from './require-qualified-refs';

/** The lint rules, in report order. */
export const LINT_RULES: LintRule[] = [
  noSetSearchPath,
  requireQualifiedRefs,
  noVariableConflict,
  noDynamicSql
];

export const LINT_RULES_BY_ID = new Map(LINT_RULES.map((r) => [r.id, r]));
export const LINT_RULES_BY_CODE = new Map(LINT_RULES.map((r) => [r.code, r]));

export { noDynamicSql, noSetSearchPath, noVariableConflict, requireQualifiedRefs };
