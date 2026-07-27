/**
 * Shared, dependency-free core for round-trip AST validation.
 *
 * This module is intentionally self-contained — it imports no parser or
 * deparser — so it can be lifted verbatim into an upstream package (e.g.
 * `@pgsql/round-trip`) and shared between:
 *
 *  - pgsql-parser's test fixtures (`cleanTree` / `expectParseDeparse`), which
 *    parse → deparse → re-parse and assert the normalized ASTs are equal, and
 *  - downstream mutation-aware validators (this package's
 *    round-trip check), which compare a *mutated* AST against the AST obtained
 *    by re-parsing the deparsed output.
 *
 * The upstream `cleanTree` is expressed here as a preset over the generic
 * `normalizeTree` engine; the downstream fortified normalizer layers extra
 * volatile keys, lazy-datum filtering, and body-sentinel handling on top of
 * the same engine (see round-trip.ts).
 */

export interface NormalizeTreeOptions {
  /** Object keys dropped entirely (volatile / non-semantic fields). */
  volatileKeys?: ReadonlySet<string>;
  /** Sort object keys so comparison is insensitive to key order. Default false. */
  sortKeys?: boolean;
  /** Array items for which this returns true are removed before recursing. */
  dropArrayItem?: (item: unknown) => boolean;
  /**
   * Per-key transform hooks keyed by object-property name. The hook receives
   * the value at that key plus a `recurse` callback (which re-enters
   * `normalizeTree` with the same options) and returns the replacement value.
   */
  keyHandlers?: Record<
    string,
    (value: any, recurse: (node: any) => any) => any
  >;
}

/**
 * Deep-clone an AST while dropping volatile keys, optionally sorting keys,
 * filtering array items, and applying per-key transform hooks. Primitives are
 * returned as-is; Dates are cloned (parity with the original upstream
 * `transform` helper).
 */
export function normalizeTree(node: any, options: NormalizeTreeOptions = {}): any {
  const { volatileKeys, sortKeys, dropArrayItem, keyHandlers } = options;
  const recurse = (n: any) => normalizeTree(n, options);

  if (Array.isArray(node)) {
    const items = dropArrayItem ? node.filter((i) => !dropArrayItem(i)) : node;
    return items.map(recurse);
  }

  if (node instanceof Date) {
    return new Date(node.getTime());
  }

  if (node && typeof node === 'object') {
    const out: Record<string, any> = {};
    const keys = sortKeys ? Object.keys(node).sort() : Object.keys(node);
    for (const key of keys) {
      if (volatileKeys?.has(key)) continue;
      const handler = keyHandlers?.[key];
      out[key] = handler ? handler(node[key], recurse) : recurse(node[key]);
    }
    return out;
  }

  return node;
}

/**
 * Return the JSON path of the first structural difference between two trees,
 * or null if they are deeply equal. Useful for actionable mismatch messages.
 */
export function firstDifference(a: any, b: any, path = '$'): string | null {
  if (a === b) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return `${path} (array length ${a.length} vs ${b.length})`;
    }
    for (let i = 0; i < a.length; i++) {
      const diff = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (diff) return diff;
    }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const diff = firstDifference(a[key], b[key], `${path}.${key}`);
      if (diff) return diff;
    }
    return null;
  }
  return `${path} (${JSON.stringify(a)} vs ${JSON.stringify(b)})`;
}

// ---------------------------------------------------------------------------
// Upstream-compatible cleanTree preset
// ---------------------------------------------------------------------------

/** Position/length fields stripped by the upstream `cleanTree`. */
export const CLEAN_TREE_VOLATILE_KEYS: ReadonlySet<string> = new Set([
  'stmt_len',
  'stmt_location',
  'location',
  'rexpr_list_start',
  'rexpr_list_end',
  'list_start',
  'list_end',
]);

/**
 * Trim the function/DO body string carried by a `DefElem` with defname "as".
 * Mirrors the in-place trimming in pgsql-parser's `cleanTree` so the body
 * text (whose surrounding whitespace legitimately shifts on deparse) does not
 * cause spurious AST mismatches. Mutates the passed DefElem in place.
 */
export function trimDefElemBody(defElem: any): void {
  if (!defElem || defElem.defname !== 'as') return;
  const arg = defElem.arg;
  if (Array.isArray(arg) && arg.length && arg[0]?.String) {
    arg[0].String.sval = arg[0].String.sval.trim();
  } else if (arg?.List?.items?.length && arg.List.items[0]?.String) {
    arg.List.items[0].String.sval = arg.List.items[0].String.sval.trim();
  } else if (arg?.String) {
    arg.String.sval = arg.String.sval.trim();
  }
}

/**
 * Upstream-compatible normalization: strips `stmt_len` / `stmt_location` /
 * `location` and trims `DefElem` "as" body strings. Equivalent to
 * pgsql-parser's deparser `cleanTree`, provided here so upstream can adopt the
 * shared core without behavior change.
 */
export function cleanTree(tree: any): any {
  return normalizeTree(tree, {
    volatileKeys: CLEAN_TREE_VOLATILE_KEYS,
    keyHandlers: {
      DefElem: (defElem: any, recurse: (n: any) => any) => {
        trimDefElemBody(defElem);
        return recurse(defElem);
      },
    },
  });
}
