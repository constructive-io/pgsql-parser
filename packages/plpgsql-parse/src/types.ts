/**
 * Types for plpgsql-parse — comment-preserving PL/pgSQL parser.
 *
 * Re-uses pgsql-parse's EnhancedParseResult for the outer SQL level
 * and adds body-level comment metadata for PL/pgSQL function bodies.
 */

import type { EnhancedParseResult } from 'pgsql-parse';

/**
 * A comment extracted from a PL/pgSQL function body.
 */
export interface BodyComment {
  /** The full comment text including -- prefix */
  text: string;
  /** 1-based line number within the function body */
  lineNo: number;
  /** Whether this is a standalone comment line (vs inline after code) */
  standalone: boolean;
}

/**
 * Metadata about a PL/pgSQL function's body comments,
 * stored alongside the parsed function data.
 */
export interface FunctionComments {
  /** Index of the RawStmt in the EnhancedParseResult.stmts array */
  stmtIndex: number;
  /** The raw body text extracted from the dollar-quoted string */
  originalBody: string;
  /** The dollar-quote delimiter (e.g., '$$', '$fn$') */
  delimiter: string;
  /** Comments found in the body, ordered by line number */
  comments: BodyComment[];
}

/**
 * The result of parsing SQL with plpgsql-parse.
 * Extends pgsql-parse's EnhancedParseResult with PL/pgSQL body comment info.
 */
export interface PlpgsqlParseResult {
  /** The outer SQL parse result with comments/whitespace preserved */
  enhanced: EnhancedParseResult;
  /** Comment metadata for each PL/pgSQL function found */
  functions: FunctionComments[];
}
