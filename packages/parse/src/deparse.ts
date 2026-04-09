/**
 * Enhanced deparser that handles synthetic RawComment and RawWhitespace nodes
 * in addition to all standard PostgreSQL AST nodes.
 *
 * This does NOT modify the upstream Deparser class. Instead, it processes
 * the EnhancedParseResult's stmts array and delegates real statements
 * to the standard deparser.
 */

import { Deparser, DeparserOptions } from 'pgsql-deparser';
import {
  EnhancedParseResult,
  isRawComment,
  isRawWhitespace,
  isRawStmt,
  RawComment,
  RawWhitespace,
} from './types';

/**
 * Deparse a single RawComment node back to SQL comment text.
 */
function deparseComment(comment: RawComment): string {
  return `--${comment.text}`;
}

/**
 * Deparse an EnhancedParseResult back to SQL, preserving comments
 * and vertical whitespace.
 *
 * The output strategy:
 * - Each real statement gets a newline separator from the previous element
 * - RawComment nodes emit their comment text
 * - RawWhitespace nodes emit blank lines (the node itself IS the separator)
 * - Adjacent statements/comments without a RawWhitespace between them
 *   get a single newline separator
 */
export function deparseEnhanced(
  result: EnhancedParseResult,
  opts: DeparserOptions = {}
): string {
  const newline = opts.newline ?? '\n';
  const lines: string[] = [];

  for (const stmt of result.stmts) {
    if (isRawComment(stmt)) {
      const commentText = deparseComment(stmt.RawComment);
      if (stmt.RawComment.trailing && lines.length > 0) {
        // Trailing comment: append to the previous line
        lines[lines.length - 1] += ' ' + commentText;
      } else {
        lines.push(commentText);
      }
    } else if (isRawWhitespace(stmt)) {
      // Each blank line in the original source becomes an empty line in output.
      // The whitespace node represents N blank lines between content.
      for (let i = 0; i < stmt.RawWhitespace.lines; i++) {
        lines.push('');
      }
    } else if (isRawStmt(stmt)) {
      // Wrap in a minimal ParseResult so the standard deparser handles it
      const sql = Deparser.deparse(
        { version: 0, stmts: [stmt] },
        opts
      );
      if (sql) {
        lines.push(sql);
      }
    }
  }

  return lines.join(newline);
}

/**
 * Sync version of deparseEnhanced.
 */
export const deparseEnhancedSync = deparseEnhanced;

/**
 * Standard deparse — re-exported from pgsql-deparser for convenience.
 * Use this when you have a standard ParseResult without synthetic nodes.
 */
export { Deparser, DeparserOptions };
