/**
 * pgsql-parse — Comment and whitespace preserving PostgreSQL parser.
 *
 * Drop-in enhancement over pgsql-parser that preserves SQL comments
 * (-- line and /* block *​/) and vertical whitespace (blank lines)
 * through parse→deparse round trips.
 *
 * Synthetic AST nodes:
 * - RawComment: represents a SQL comment
 * - RawWhitespace: represents significant vertical whitespace
 *
 * These nodes are interleaved with real RawStmt entries in the
 * stmts array, ordered by byte position in the original source.
 */

// Enhanced parse functions (comment/whitespace preserving)
export { parse, parseSync } from './parse';

// Enhanced deparse function
export { deparseEnhanced, deparseEnhancedSync, Deparser, DeparserOptions } from './deparse';

// Re-export standard deparse for non-enhanced use
export { deparse, deparseSync } from 'pgsql-deparser';

// Re-export loadModule from libpg-query
export { loadModule } from 'libpg-query';

// Types
export {
  RawComment,
  RawWhitespace,
  EnhancedStmt,
  EnhancedParseResult,
  isRawComment,
  isRawWhitespace,
  isRawStmt,
} from './types';

// Scanner (for advanced use)
export { scanComments, ScannedComment, ScannedWhitespace, ScannedElement } from './scanner';
