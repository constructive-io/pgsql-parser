/**
 * Enhanced parse functions that preserve comments and vertical whitespace
 * by interleaving synthetic RawComment and RawWhitespace nodes into the
 * parse result's stmts array.
 */

import { parse as libParse, parseSync as libParseSync } from '@libpg-query/parser';
import { ParseResult, RawStmt } from '@pgsql/types';
import { scanComments, ScannedElement } from './scanner';
import { EnhancedParseResult, EnhancedStmt } from './types';

interface SortableEntry {
  position: number;
  /** Lower priority number = sorted first when positions are equal */
  priority: number;
  entry: EnhancedStmt;
}

/**
 * Find the actual SQL start position for a statement by skipping
 * past any comments and whitespace that the parser included in
 * the stmt_location..stmt_location+stmt_len range.
 *
 * The parser's stmt_location often includes preceding whitespace
 * and comments that were stripped during parsing. We need the
 * position of the first real SQL token.
 */
function findActualSqlStart(
  sql: string,
  stmtLoc: number,
  elements: ScannedElement[]
): number {
  let pos = stmtLoc;

  // Iteratively skip whitespace and any scanned elements (comments/whitespace)
  // that start at or after our current position
  let changed = true;
  while (changed) {
    changed = false;

    // Skip whitespace characters
    while (pos < sql.length && /\s/.test(sql[pos])) {
      pos++;
      changed = true;
    }

    // Skip past any scanned element that starts at current position
    for (const elem of elements) {
      if (elem.value.start === pos || (elem.value.start >= stmtLoc && elem.value.start < pos + 1 && elem.value.end > pos)) {
        if (elem.value.end > pos) {
          pos = elem.value.end;
          changed = true;
        }
      }
    }
  }

  return pos;
}

/**
 * Merge scanned comments/whitespace with parsed statements,
 * ordering all entries by their byte position in the original source.
 *
 * We use a unified sort approach rather than a merge of two sorted lists
 * because stmt_location can include preceding whitespace/comments,
 * making a simple merge unreliable.
 */
function interleave(
  parseResult: ParseResult,
  sql: string,
  elements: ScannedElement[]
): EnhancedParseResult {
  const stmts = parseResult.stmts ?? [];
  const items: SortableEntry[] = [];

  // Add scanned elements (comments and whitespace)
  for (const elem of elements) {
    if (elem.kind === 'comment') {
      items.push({
        position: elem.value.start,
        priority: 0,
        entry: {
          RawComment: {
            type: elem.value.type,
            text: elem.value.text,
            location: elem.value.start,
          }
        }
      });
    } else {
      items.push({
        position: elem.value.start,
        priority: 1, // whitespace sorts after comments at same position
        entry: {
          RawWhitespace: {
            lines: elem.value.lines,
            location: elem.value.start,
          }
        }
      });
    }
  }

  // Add parsed statements with their actual SQL start position
  for (const stmt of stmts) {
    const loc = stmt.stmt_location ?? 0;
    const actualStart = findActualSqlStart(sql, loc, elements);
    items.push({
      position: actualStart,
      priority: 2, // statements sort after comments and whitespace
      entry: stmt,
    });
  }

  // Sort by position, then by priority
  items.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.priority - b.priority;
  });

  return {
    version: parseResult.version,
    stmts: items.map(item => item.entry),
  };
}

/**
 * Parse SQL with comment and whitespace preservation (async).
 *
 * Returns an EnhancedParseResult where the stmts array contains
 * real RawStmt entries interleaved with synthetic RawComment and
 * RawWhitespace nodes, all ordered by their byte position in the
 * original source text.
 */
export async function parse(sql: string): Promise<EnhancedParseResult> {
  const parseResult: ParseResult = await libParse(sql);
  const elements = scanComments(sql);
  return interleave(parseResult, sql, elements);
}

/**
 * Parse SQL with comment and whitespace preservation (sync).
 */
export function parseSync(sql: string): EnhancedParseResult {
  const parseResult: ParseResult = libParseSync(sql);
  const elements = scanComments(sql);
  return interleave(parseResult, sql, elements);
}
