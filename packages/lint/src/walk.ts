/**
 * The one AST helper the rules need, layered on `@pgsql/traverse`'s `walk`.
 */

import { NodePath, walk } from '@pgsql/traverse';

/** Find every node tagged with `tag` (e.g. `RangeVar`, `CommonTableExpr`). */
export function findAll(root: unknown, tag: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  walk(root as object, (path: NodePath) => {
    if (path.tag === tag) {
      out.push(path.node as Record<string, unknown>);
    }
  });
  return out;
}
