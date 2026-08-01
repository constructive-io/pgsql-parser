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
export { loadModule,parse, parseSync } from './parse';

// Enhanced deparse functions
export { deparse, type DeparseOptions,deparseSync } from './deparse';

// Types
export type {
  BodyComment,
  FunctionComments,
  PlpgsqlParseResult,
} from './types';

// Body scanner (for advanced use)
export { type CommentGroup,groupCommentsByAnchor, scanBodyComments } from './body-scanner';

// Re-export pgsql-parse types for convenience
export type { EnhancedParseResult, EnhancedStmt, RawComment, RawWhitespace } from 'pgsql-parse';
export { isRawComment, isRawStmt,isRawWhitespace } from 'pgsql-parse';
