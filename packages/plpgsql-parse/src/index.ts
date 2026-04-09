/**
 * plpgsql-parse — Comment and whitespace preserving PL/pgSQL parser.
 *
 * Drop-in enhancement over plpgsql-parser that preserves SQL -- line
 * comments and vertical whitespace (blank lines) through parse→deparse
 * round trips, both at the outer SQL level (between statements) and
 * inside PL/pgSQL function bodies.
 *
 * This package wraps plpgsql-parser, plpgsql-deparser, and pgsql-parse
 * without modifying any of them.
 */

// Enhanced parse functions (comment/whitespace preserving)
export { parse, parseSync, loadModule } from './parse';

// Enhanced deparse functions
export { deparse, deparseSync, type DeparseOptions } from './deparse';

// Types
export type {
  PlpgsqlParseResult,
  FunctionComments,
  BodyComment,
} from './types';

// Body scanner (for advanced use)
export { scanBodyComments, groupCommentsByAnchor, type CommentGroup } from './body-scanner';

// Re-export pgsql-parse types for convenience
export type { EnhancedParseResult, EnhancedStmt, RawComment, RawWhitespace } from 'pgsql-parse';
export { isRawComment, isRawWhitespace, isRawStmt } from 'pgsql-parse';
