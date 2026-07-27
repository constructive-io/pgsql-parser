/**
 * Round-trip validation for the schema transform.
 *
 * After the transform deparses its mutated AST to SQL text, the emitted text
 * must parse back to an AST that is structurally identical to the AST we
 * deparsed (AST1 === AST2 after normalization). Any mismatch means the
 * deparser dropped or mangled something (e.g. array bounds on a DECLAREd
 * type), even though the output may still be syntactically valid SQL.
 *
 * Two comparisons are performed per file:
 * - the SQL-level parse tree (with volatile fields and function body strings
 *   normalized — PL/pgSQL bodies are compared separately)
 * - each PL/pgSQL function body, compared in dehydrated form so both sides
 *   go through the same hydrate -> dehydrate rendering
 */

import { dehydratePlpgsqlAst,transformSync } from 'plpgsql-parser';

import {
  CLEAN_TREE_VOLATILE_KEYS,
  firstDifference,
  normalizeTree,
} from './round-trip-core';

export { firstDifference };

/**
 * Fields that legitimately differ between parses. Extends the upstream
 * `cleanTree` volatile set (location/stmt_location/stmt_len) with:
 * - lineno: source positions in PL/pgSQL nodes
 * - dno/varno/recparentno: PL/pgSQL datum numbers — compiler bookkeeping
 *   assigned in parse-encounter order, which shifts when the deparser
 *   emits an equivalent-but-reordered statement (e.g. INTO placement).
 *   Structural identity is still checked via names/fieldnames.
 */
const VOLATILE_KEYS = new Set<string>([
  ...CLEAN_TREE_VOLATILE_KEYS,
  'lineno',
  'dno',
  'varno',
  'recparentno',
]);

/**
 * PLpgSQL_recfield datums are created lazily by the PL/pgSQL compiler as
 * record.field references are encountered while parsing expressions, so
 * their presence/order in the datums array depends on expression text
 * layout, not semantics.
 */
function isRecfieldDatum(node: unknown): boolean {
  return !!node && typeof node === 'object' && 'PLpgSQL_recfield' in node;
}

/**
 * Fortified, mutation-aware normalizer built on the shared round-trip core.
 * Beyond the upstream `cleanTree` (position stripping + body trimming), it
 * additionally sorts keys, drops lazily-created recfield datums, and replaces
 * DefElem "as" bodies with a sentinel (PL/pgSQL body fidelity is checked
 * separately via the dehydrated PL/pgSQL ASTs).
 */
export function normalizeParseTree(node: any): any {
  return normalizeTree(node, {
    volatileKeys: VOLATILE_KEYS,
    sortKeys: true,
    dropArrayItem: isRecfieldDatum,
    keyHandlers: {
      DefElem: (defElem: any, recurse: (n: any) => any) =>
        defElem?.defname === 'as'
          ? { ...recurse(defElem), arg: '<body>' }
          : recurse(defElem),
    },
  });
}

export interface CapturedAsts {
  sqlAst: any;
  plpgsqlAsts: any[];
}

/**
 * Capture the normalized SQL parse tree and dehydrated PL/pgSQL function
 * ASTs from a transform context (as produced by plpgsql-parser's
 * transformSync callback). Call this AFTER mutating the context.
 */
export function captureTransformAsts(ctx: any): CapturedAsts {
  const plpgsqlAsts: any[] = [];
  for (const fn of ctx.functions) {
    if (fn.plpgsql?.hydrated) {
      plpgsqlAsts.push(
        normalizeParseTree(
          dehydratePlpgsqlAst(structuredClone(fn.plpgsql.hydrated))
        )
      );
    }
  }
  return {
    sqlAst: normalizeParseTree(ctx.sql),
    plpgsqlAsts,
  };
}

/**
 * Parse already-transformed SQL text and capture its ASTs the same way
 * capture_transform_asts does for the pre-deparse context, so the two
 * sides are directly comparable.
 */
export function captureAstsFromSql(sql: string): CapturedAsts {
  let captured: CapturedAsts | undefined;
  transformSync(
    sql,
    (ctx: any) => {
      captured = captureTransformAsts(ctx);
    },
    { hydrate: true, pretty: true }
  );
  if (!captured) {
    throw new Error('round-trip: failed to capture ASTs from transformed SQL');
  }
  return captured;
}

/**
 * Assert that the transformed AST (captured before deparse) matches the AST
 * obtained by re-parsing the emitted SQL. Throws with the first differing
 * path on mismatch.
 */
export function validateRoundTrip(
  before: CapturedAsts,
  transformedSql: string
): void {
  const after = captureAstsFromSql(transformedSql);

  const sqlDiff = firstDifference(before.sqlAst, after.sqlAst);
  if (sqlDiff) {
    throw new Error(
      `round-trip validation failed: SQL AST mismatch after deparse at ${sqlDiff}`
    );
  }

  if (before.plpgsqlAsts.length !== after.plpgsqlAsts.length) {
    throw new Error(
      `round-trip validation failed: PL/pgSQL function count mismatch ` +
        `(${before.plpgsqlAsts.length} before deparse vs ${after.plpgsqlAsts.length} after re-parse)`
    );
  }

  for (let i = 0; i < before.plpgsqlAsts.length; i++) {
    const diff = firstDifference(
      before.plpgsqlAsts[i],
      after.plpgsqlAsts[i]
    );
    if (diff) {
      throw new Error(
        `round-trip validation failed: PL/pgSQL AST mismatch in function #${i} at ${diff}`
      );
    }
  }
}
