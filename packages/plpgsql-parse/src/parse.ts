/**
 * Enhanced parse that wraps plpgsql-parser and pgsql-parse to preserve
 * both outer SQL comments/whitespace AND comments inside PL/pgSQL
 * function bodies.
 *
 * This module does NOT modify plpgsql-parser or pgsql-parse — it
 * composes them and adds body-comment metadata on top.
 */

import {
  parseSync as parseSqlSync,
  parsePlPgSQLSync,
  loadModule,
} from '@libpg-query/parser';
import type { ParseResult } from '@libpg-query/parser';
import { parseSync as pgsqlParseSync } from 'pgsql-parse';
import type { EnhancedParseResult, EnhancedStmt } from 'pgsql-parse';
import {
  hydratePlpgsqlAst,
  type PLpgSQLParseResult,
} from 'plpgsql-deparser';
import { scanBodyComments } from './body-scanner';
import type { PlpgsqlParseResult, FunctionComments } from './types';

export { loadModule };

/**
 * Check if a statement is a CREATE FUNCTION with LANGUAGE plpgsql.
 */
function isPlpgsqlFunction(stmt: any): boolean {
  const createFunctionStmt = stmt?.CreateFunctionStmt;
  if (!createFunctionStmt) return false;
  const options = createFunctionStmt.options;
  if (!options) return false;
  for (const opt of options) {
    if (opt?.DefElem?.defname === 'language') {
      const arg = opt.DefElem.arg;
      if (arg?.String?.sval) {
        return arg.String.sval.toLowerCase() === 'plpgsql';
      }
    }
  }
  return false;
}

/**
 * Extract the raw function body and dollar-quote delimiter from a
 * CREATE FUNCTION statement's AST options.
 */
function getBodyFromOptions(options: any[]): { raw: string; delimiter: string } | null {
  if (!options) return null;
  for (const opt of options) {
    if (opt?.DefElem?.defname === 'as') {
      const arg = opt.DefElem.arg;
      if (arg?.List?.items?.[0]?.String?.sval) {
        return { raw: arg.List.items[0].String.sval, delimiter: '$$' };
      }
      if (arg?.String?.sval) {
        return { raw: arg.String.sval, delimiter: '$$' };
      }
    }
  }
  return null;
}

/**
 * Parse SQL with full comment preservation — both outer SQL level
 * (between statements) and inside PL/pgSQL function bodies.
 *
 * Combines:
 * - pgsql-parse's scanner for outer SQL comments/whitespace
 * - plpgsql-parser's PL/pgSQL body parsing + hydration
 * - body-scanner for function body comments
 */
export function parseSync(sql: string): PlpgsqlParseResult {
  // 1. Outer SQL: use pgsql-parse for comment/whitespace preservation
  const enhanced: EnhancedParseResult = pgsqlParseSync(sql);

  // 2. Also parse with the standard SQL parser to get statement ASTs
  const sqlResult: ParseResult = parseSqlSync(sql);
  const stmts = sqlResult.stmts ?? [];

  // 3. For each PL/pgSQL function, extract body comments
  const functions: FunctionComments[] = [];

  for (let i = 0; i < stmts.length; i++) {
    const rawStmt = stmts[i];
    const stmt = rawStmt?.stmt as any;
    if (!stmt || !isPlpgsqlFunction(stmt)) continue;

    const createFunctionStmt = stmt.CreateFunctionStmt;
    const body = getBodyFromOptions(createFunctionStmt.options);
    if (!body) continue;

    // Scan the body for comments
    const comments = scanBodyComments(body.raw);
    if (comments.length === 0) continue;

    // Find the matching index in the enhanced stmts array.
    // The enhanced array may have synthetic nodes interleaved,
    // so we match by searching for the RawStmt at the right position.
    const enhancedIndex = findEnhancedStmtIndex(enhanced, i);

    functions.push({
      stmtIndex: enhancedIndex,
      originalBody: body.raw,
      delimiter: body.delimiter,
      comments,
    });
  }

  return { enhanced, functions };
}

/**
 * Async version of parseSync.
 */
export async function parse(sql: string): Promise<PlpgsqlParseResult> {
  return parseSync(sql);
}

/**
 * Find the index of the i-th RawStmt in the enhanced stmts array.
 * The enhanced array interleaves RawComment and RawWhitespace nodes,
 * so the n-th real statement isn't at index n.
 */
function findEnhancedStmtIndex(enhanced: EnhancedParseResult, rawStmtIndex: number): number {
  let realCount = 0;
  for (let j = 0; j < enhanced.stmts.length; j++) {
    const entry = enhanced.stmts[j];
    if ('stmt' in entry) {
      if (realCount === rawStmtIndex) return j;
      realCount++;
    }
  }
  // Fallback: return the rawStmtIndex (shouldn't happen)
  return rawStmtIndex;
}
