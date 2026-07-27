import { classifyStatements, StatementFacts } from './facts';

/**
 * A category is a chunk-seam key a change is assigned to. Free-form string; the
 * built-in {@link TIER_PROFILE} uses `'security' | 'functionality' | 'fixtures'
 * | 'schema'`.
 *
 * This module is the classifier-driven counterpart to `@pgpmjs/core`'s
 * `boundary: 'category'` rebundle mode: core stays classifier-agnostic and only
 * consumes a `categoryOf(changeName)` seam function, while the rules that decide
 * *what* each change is (the profile) live here, next to the AST facts.
 */
export type ChangeCategory = string;

/**
 * Decides a change's category from the AST facts of its (deploy) statements.
 * A profile is a pure function of the facts — swap it to carve a monolith along
 * different seams (e.g. per-role admin/users modules) without touching core.
 */
export interface CategoryProfile {
  /** Identifier for the profile (for logging / provenance). */
  name: string;
  /** Map a change's statement facts to its category. */
  categorize: (facts: StatementFacts[], changeName: string) => ChangeCategory;
}

/**
 * Default tier profile: isolates the security surface and procedural code out
 * of the schema base. Precedence, highest first — a change is placed in the
 * most specialized tier any of its statements reaches:
 *
 *   security       any securityRelevant statement (policy/grant/RLS/role/owner)
 *   functionality  functions and triggers
 *   fixtures       seed DML (INSERT/UPDATE/DELETE)
 *   schema         schemas, tables, views, indexes, types, constraints (base)
 *
 * Ordering/dependencies across the resulting chunks are still resolved by
 * core's rebundle graph, so this only decides *naming/grouping*, never deploy
 * order.
 */
export const TIER_PROFILE: CategoryProfile = {
  name: 'tier',
  categorize(facts): ChangeCategory {
    if (facts.length === 0) return 'schema';
    if (facts.some(f => f.securityRelevant)) return 'security';
    if (facts.some(f => f.kind === 'function' || f.kind === 'trigger')) return 'functionality';
    if (facts.some(f => f.kind === 'seed_dml')) return 'fixtures';
    return 'schema';
  },
};

/**
 * Classify a single change's deploy SQL into its category under `profile`
 * (defaults to {@link TIER_PROFILE}).
 */
export function categorizeChange(
  sql: string,
  changeName: string,
  profile: CategoryProfile = TIER_PROFILE
): ChangeCategory {
  return profile.categorize(classifyStatements(sql), changeName);
}

/**
 * Build a `categoryOf(changeName)` seam function from a map of change name to
 * its deploy SQL — ready to pass straight to `@pgpmjs/core`'s rebundle
 * `boundary: 'category'` / `categoryOf` options.
 *
 * Changes absent from `changeSql` return `undefined`, letting core fall back to
 * its folder key for anything the classifier did not see.
 */
export function buildCategoryOf(
  changeSql: Record<string, string>,
  profile: CategoryProfile = TIER_PROFILE
): (changeName: string) => ChangeCategory | undefined {
  const categories = new Map<string, ChangeCategory>();
  for (const [name, sql] of Object.entries(changeSql)) {
    categories.set(name, categorizeChange(sql, name, profile));
  }
  return (changeName: string): ChangeCategory | undefined => categories.get(changeName);
}
