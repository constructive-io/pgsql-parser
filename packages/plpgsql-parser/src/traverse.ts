/**
 * SQL text traversal.
 *
 * The walkers themselves live in `@pgsql/traverse`, which knows nothing about
 * parsing. This module owns the one thing that genuinely needs a parser: going
 * from a **SQL string** to a walk over both its statements and its hydrated
 * PL/pgSQL function bodies.
 */

import type {
  UnifiedVisitor,
  UnifiedWalker,
  WalkOptions,
  WalkResult,
} from '@pgsql/traverse';
import { walk } from '@pgsql/traverse';

import { parseSync } from './parse';

export interface WalkSqlOptions extends WalkOptions {
  /**
   * Hydrate and walk PL/pgSQL function bodies. Turning this off skips the
   * PL/pgSQL parse entirely, not just the traversal. Default: true
   */
  walkFunctionBodies?: boolean;
}

/**
 * Parse a SQL string, hydrate its PL/pgSQL function bodies, and walk the whole
 * thing with the given visitors.
 *
 * ```ts
 * const result = walkSql(sql, {
 *   RangeVar: (path, ctx) => {
 *     if (ctx.isWrite && path.node.schemaname === 'audit') {
 *       ctx.abort('audit schema is read-only');
 *     }
 *   },
 *   PLpgSQL_stmt_dynexecute: (_path, ctx) => ctx.abort('dynamic EXECUTE is not allowed'),
 * });
 * ```
 *
 * Unparseable input is reported as an abort rather than a thrown error, so a
 * validator can treat "rejected" and "could not be understood" uniformly.
 */
export function walkSql(
  sql: string,
  visitors: UnifiedVisitor | UnifiedWalker | Array<UnifiedVisitor | UnifiedWalker>,
  options: WalkSqlOptions = {},
): WalkResult {
  const walkFunctionBodies = options.walkFunctionBodies ?? true;

  if (!sql || sql.trim().length === 0) {
    return { aborted: false, reason: undefined, reasons: [] };
  }

  let parsed;
  try {
    parsed = parseSync(sql, { hydrate: walkFunctionBodies });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unparseable SQL';
    return { aborted: true, reason, reasons: [reason] };
  }

  return walk(parsed, visitors, { ...options, walkFunctionBodies });
}
