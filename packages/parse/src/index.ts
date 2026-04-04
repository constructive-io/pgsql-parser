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

// Unified loadModule that initializes both the library's WASM
// (for parse/deparse) and our scanner's WASM (for _wasm_scan).
import { loadModule as libLoadModule } from '@libpg-query/parser';
import { initWasm } from './scanner';

export async function loadModule(): Promise<void> {
  await Promise.all([libLoadModule(), initWasm()]);
}

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
