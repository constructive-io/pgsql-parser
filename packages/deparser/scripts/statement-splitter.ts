import { ParseResult, RawStmt } from '@pgsql/types';
import { parse } from 'libpg-query';

export interface ExtractedStatement {
  statement: string;
  index: number;
  location?: number;
  length?: number;
}

export interface StatementSplitterOptions {
  /** Skip validation for malformed statements */
  skipValidation?: boolean;
  /** Strip leading comments from extracted statements */
  stripComments?: boolean;
}

/**
 * Extracts a single statement from SQL using PostgreSQL's location information.
 * Handles Unicode properly by using byte positions instead of character positions.
 */
export function extractStatement(
  originalSQL: string, 
  rawStmt: RawStmt, 
  isFirst: boolean = false,
  options: StatementSplitterOptions = {}
): string | null {
  let extracted: string | null = null;
  
  // Convert string to buffer to handle byte positions correctly (for Unicode)
  const sqlBuffer = Buffer.from(originalSQL, 'utf8');
  
  if (rawStmt.stmt_location !== undefined && rawStmt.stmt_len !== undefined) {
    // Use byte positions as provided by PostgreSQL
    const startByte = rawStmt.stmt_location;
    const endByte = rawStmt.stmt_location + rawStmt.stmt_len;
    
    // Extract using byte positions and convert back to string
    const extractedBuffer = sqlBuffer.slice(startByte, endByte);
    extracted = extractedBuffer.toString('utf8');
  } else if (rawStmt.stmt_location !== undefined && rawStmt.stmt_len === undefined) {
    // We have location but no length - extract from location to end of file
    const extractedBuffer = sqlBuffer.slice(rawStmt.stmt_location);
    extracted = extractedBuffer.toString('utf8');
  } else if (isFirst && rawStmt.stmt_len !== undefined) {
    // For first statement when location is missing but we have length
    const extractedBuffer = sqlBuffer.slice(0, rawStmt.stmt_len);
    extracted = extractedBuffer.toString('utf8');
  } else if (isFirst && rawStmt.stmt_location === undefined && rawStmt.stmt_len === undefined) {
    // For first statement when both location and length are missing, use entire SQL
    extracted = originalSQL;
  }
  
  if (extracted && options.stripComments !== false) {
    // Split into lines to handle leading whitespace and comments properly
    const lines = extracted.split('\n');
    let startLineIndex = 0;
    
    // Find the first line that contains actual SQL content
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip empty lines and comment-only lines
      if (line === '' || line.startsWith('--')) {
        continue;
      }
      startLineIndex = i;
      break;
    }
    
    // Reconstruct from the first SQL line, preserving the original indentation of that line
    if (startLineIndex < lines.length) {
      const resultLines = lines.slice(startLineIndex);
      extracted = resultLines.join('\n').trim();
    }
  }
  
  // Final validation unless skipped
  if (extracted && !options.skipValidation) {
    const firstLine = extracted.split('\n')[0].trim();
    const firstWord = firstLine.split(/\s+/)[0].toUpperCase();
    
    // Only check for most obvious malformed patterns at the BEGINNING
    if (
      // Check if it starts with truncated patterns (not just contains anywhere)
      extracted.trim().startsWith('ELECT ') || // Missing S from SELECT
      extracted.trim().startsWith('REATE ') || // Missing C from CREATE  
      extracted.trim().startsWith('NSERT ') || // Missing I from INSERT
      // Completely empty or whitespace only
      extracted.trim().length === 0
    ) {
      return null; // Invalid extraction, skip this statement
    }
  }
  
  return extracted;
}

/**
 * Splits SQL text into individual statements using PostgreSQL's parser.
 * Handles Unicode characters properly and provides detailed location information.
 */
export async function splitStatements(
  sql: string, 
  options: StatementSplitterOptions = {}
): Promise<ExtractedStatement[]> {
  const parseResult: ParseResult = await parse(sql);
  const statements: ExtractedStatement[] = [];
  
  if (!parseResult.stmts) {
    return statements;
  }
  
  for (let idx = 0; idx < parseResult.stmts.length; idx++) {
    const stmt = parseResult.stmts[idx];
    const extracted = extractStatement(sql, stmt, idx === 0, options);
    
    if (extracted) {
      statements.push({
        statement: extracted,
        index: idx,
        location: stmt.stmt_location,
        length: stmt.stmt_len
      });
    }
  }
  
  return statements;
}

/**
 * Utility to generate statement keys for fixtures
 */
export function generateStatementKey(
  relativePath: string, 
  statementIndex: number, 
  extension: string = 'sql'
): string {
  return `${relativePath.replace(/\.sql$/, '')}-${statementIndex + 1}.${extension}`;
}

/**
 * Test utility to compare byte vs character extraction for debugging Unicode issues
 */
export function debugUnicodeExtraction(sql: string, rawStmt: RawStmt): {
  characterBased: string;
  byteBased: string;
  matches: boolean;
  unicodeChars: number;
  byteLength: number;
  charLength: number;
} {
  const charLength = sql.length;
  const byteLength = Buffer.from(sql, 'utf8').length;
  
  // Character-based extraction (old way)
  let characterBased = '';
  if (rawStmt.stmt_location !== undefined && rawStmt.stmt_len !== undefined) {
    characterBased = sql.substring(rawStmt.stmt_location, rawStmt.stmt_location + rawStmt.stmt_len);
  }
  
  // Byte-based extraction (new way)
  let byteBased = '';
  if (rawStmt.stmt_location !== undefined && rawStmt.stmt_len !== undefined) {
    const sqlBuffer = Buffer.from(sql, 'utf8');
    const extractedBuffer = sqlBuffer.slice(rawStmt.stmt_location, rawStmt.stmt_location + rawStmt.stmt_len);
    byteBased = extractedBuffer.toString('utf8');
  }
  
  return {
    characterBased,
    byteBased,
    matches: characterBased === byteBased,
    unicodeChars: byteLength - charLength,
    byteLength,
    charLength
  };
}