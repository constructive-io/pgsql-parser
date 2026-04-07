import { ParseResult, RawStmt } from '@pgsql/types';

/**
 * Synthetic AST node representing a SQL comment.
 * Not produced by PostgreSQL's parser — injected by pgsql-parse
 * to preserve comments through parse→deparse round trips.
 */
export interface RawComment {
  /** Always 'line' — only -- comments are supported */
  type: 'line';
  /** The comment text (without the -- delimiter) */
  text: string;
  /** Byte offset in the original source (for ordering) */
  location: number;
}

/**
 * Synthetic AST node representing significant vertical whitespace.
 * Represents one or more blank lines between statements.
 */
export interface RawWhitespace {
  /** Number of blank lines */
  lines: number;
  /** Byte offset in the original source (for ordering) */
  location: number;
}

/**
 * A statement entry that can hold either a real RawStmt or a synthetic node.
 * The stmts array in EnhancedParseResult contains these.
 */
export type EnhancedStmt =
  | RawStmt
  | { RawComment: RawComment }
  | { RawWhitespace: RawWhitespace };

/**
 * Enhanced parse result that includes synthetic comment and whitespace nodes
 * interleaved with the real RawStmt entries by byte position.
 */
export interface EnhancedParseResult {
  version: number;
  stmts: EnhancedStmt[];
}

/**
 * Type guard: check if a stmt entry is a RawComment node.
 */
export function isRawComment(stmt: EnhancedStmt): stmt is { RawComment: RawComment } {
  return 'RawComment' in stmt;
}

/**
 * Type guard: check if a stmt entry is a RawWhitespace node.
 */
export function isRawWhitespace(stmt: EnhancedStmt): stmt is { RawWhitespace: RawWhitespace } {
  return 'RawWhitespace' in stmt;
}

/**
 * Type guard: check if a stmt entry is a real RawStmt.
 */
export function isRawStmt(stmt: EnhancedStmt): stmt is RawStmt {
  return 'stmt' in stmt;
}
