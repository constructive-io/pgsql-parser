/**
 * Scanner for extracting comments and vertical whitespace
 * from PostgreSQL SQL source text.
 *
 * Uses PostgreSQL's real lexer via @libpg-query/parser's scanSync()
 * to identify SQL_COMMENT tokens with exact byte positions.
 * Whitespace detection uses token gaps to find blank lines
 * between statements/comments.
 *
 * Note: @libpg-query/parser has an upstream JSON serialization bug in
 * _wasm_scan where literal control characters in token text are not
 * escaped. We work around this by retrying with a patched JSON.parse
 * that escapes control characters before parsing.
 */

import { scanSync, type ScanToken } from '@libpg-query/parser';

/**
 * Escape unescaped control characters inside JSON string values.
 * The upstream _wasm_scan emits raw \n, \r, \t in token text fields,
 * which breaks JSON.parse. This replaces them with their escape sequences.
 */
function fixScanJson(raw: string): string {
  return raw.replace(
    /"(?:[^"\\]|\\.)*"/g,
    (match) =>
      match
        .replace(/\t/g, '\\t')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
  );
}

/**
 * Call scanSync with a workaround for the upstream JSON serialization bug.
 * First tries the normal path; if JSON.parse throws, retries with a
 * temporarily patched JSON.parse that escapes control characters.
 * This is synchronous so there are no concurrency concerns.
 */
function safeScanSync(sql: string): { tokens: ScanToken[] } {
  try {
    return scanSync(sql);
  } catch {
    // Retry with patched JSON.parse to handle unescaped control chars
    const origParse = JSON.parse;
    try {
      JSON.parse = ((text: string, reviver?: Parameters<typeof JSON.parse>[1]) =>
        origParse(fixScanJson(text), reviver)) as typeof JSON.parse;
      return scanSync(sql);
    } finally {
      JSON.parse = origParse;
    }
  }
}

/** Token type for -- line comments from PostgreSQL's lexer */
const SQL_COMMENT = 275;

export interface ScannedComment {
  type: 'line';
  /** The comment text (without the -- delimiter) */
  text: string;
  /** Byte offset of the start of the comment (including --) */
  start: number;
  /** Byte offset of the end of the comment (exclusive) */
  end: number;
}

export interface ScannedWhitespace {
  /** Number of blank lines (consecutive \n\n sequences) */
  lines: number;
  /** Byte offset of the start of the whitespace region */
  start: number;
  /** Byte offset of the end of the whitespace region */
  end: number;
}

export type ScannedElement = 
  | { kind: 'comment'; value: ScannedComment }
  | { kind: 'whitespace'; value: ScannedWhitespace };

/**
 * Count blank lines in a string region.
 * Returns 0 if there are fewer than 2 newlines (no blank line).
 */
function countBlankLines(text: string): number {
  let newlines = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') newlines++;
  }
  return newlines >= 2 ? newlines - 1 : 0;
}

/**
 * Scan SQL source text and extract all -- line comments and significant
 * vertical whitespace (2+ consecutive newlines).
 *
 * Uses PostgreSQL's real lexer (via WASM scanSync) for comment detection,
 * so all string literal types (single-quoted, dollar-quoted,
 * escape strings, etc.) are handled correctly by the actual
 * PostgreSQL scanner — no reimplementation needed.
 */
export function scanComments(sql: string): ScannedElement[] {
  const elements: ScannedElement[] = [];

  let tokens: ScanToken[];
  try {
    const scanResult = safeScanSync(sql);
    tokens = scanResult.tokens;
  } catch {
    return [];
  }

  let prevEnd = 0;

  for (const token of tokens) {
    if (token.start > prevEnd) {
      const gap = sql.substring(prevEnd, token.start);
      const blankLines = countBlankLines(gap);
      if (blankLines > 0) {
        elements.push({
          kind: 'whitespace',
          value: {
            lines: blankLines,
            start: prevEnd,
            end: token.start,
          }
        });
      }
    }

    if (token.tokenType === SQL_COMMENT) {
      elements.push({
        kind: 'comment',
        value: {
          type: 'line',
          text: sql.substring(token.start + 2, token.end), // strip --
          start: token.start,
          end: token.end,
        }
      });
    }

    prevEnd = token.end;
  }

  if (prevEnd < sql.length) {
    const gap = sql.substring(prevEnd, sql.length);
    const blankLines = countBlankLines(gap);
    if (blankLines > 0) {
      elements.push({
        kind: 'whitespace',
        value: {
          lines: blankLines,
          start: prevEnd,
          end: sql.length,
        }
      });
    }
  }

  elements.sort((a, b) => a.value.start - b.value.start);

  return elements;
}
