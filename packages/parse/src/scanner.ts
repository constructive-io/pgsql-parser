/**
 * Scanner for extracting comments and vertical whitespace
 * from PostgreSQL SQL source text.
 *
 * Uses PostgreSQL's real lexer via @libpg-query/parser's scanSync()
 * to identify SQL_COMMENT tokens with exact byte positions.
 * Whitespace detection uses token gaps to find blank lines
 * between statements/comments.
 */

import { scanSync, type ScanToken } from '@libpg-query/parser';

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
  /** True if this comment is on the same line as a preceding token (trailing comment) */
  trailing: boolean;
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
    const scanResult = scanSync(sql);
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
      // A comment is "trailing" if no newline exists between the previous
      // token's end and this comment's start (i.e. same line).
      const gapBeforeComment = sql.substring(prevEnd, token.start);
      const trailing = prevEnd > 0 && !gapBeforeComment.includes('\n');

      elements.push({
        kind: 'comment',
        value: {
          type: 'line',
          text: sql.substring(token.start + 2, token.end), // strip --
          start: token.start,
          end: token.end,
          trailing,
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
