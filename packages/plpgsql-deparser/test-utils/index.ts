import { parsePlPgSQL, parsePlPgSQLSync } from '@libpg-query/parser';
import { deparseSync, PLpgSQLParseResult } from '../src';
import { readFileSync, readdirSync, existsSync } from 'fs';
import * as path from 'path';
import { diff } from 'jest-diff';

const PLPGSQL_FIXTURES_DIR = path.join(__dirname, '../../../__fixtures__/plpgsql');
const GENERATED_JSON = path.join(__dirname, '../../../__fixtures__/plpgsql-generated/generated.json');

export interface PLpgSQLTestCase {
  name: string;
  sql: string;
  functionBody: string;
}

export function extractFunctionBodies(sql: string): string[] {
  const bodies: string[] = [];
  const dollarQuoteRegex = /\$\$([^]*?)\$\$/g;
  let match;
  while ((match = dollarQuoteRegex.exec(sql)) !== null) {
    const body = match[1].trim();
    if (body && body.length > 0) {
      bodies.push(body);
    }
  }
  return bodies;
}

export function loadPLpgSQLFixtures(): PLpgSQLTestCase[] {
  const testCases: PLpgSQLTestCase[] = [];
  
  try {
    const files = readdirSync(PLPGSQL_FIXTURES_DIR).filter(f => f.endsWith('.sql'));
    
    for (const file of files) {
      const filePath = path.join(PLPGSQL_FIXTURES_DIR, file);
      const sql = readFileSync(filePath, 'utf-8');
      const bodies = extractFunctionBodies(sql);
      
      bodies.forEach((body, index) => {
        testCases.push({
          name: `${file}:${index + 1}`,
          sql,
          functionBody: body,
        });
      });
    }
  } catch (err) {
    console.warn('Could not load PL/pgSQL fixtures:', err);
  }
  
  return testCases;
}

const noop = (): undefined => undefined;

/**
 * Normalize SQL whitespace for comparison purposes.
 * Collapses multiple whitespace characters (spaces, tabs, newlines) into single spaces,
 * but preserves content inside string literals and dollar-quoted strings.
 */
const normalizeQueryWhitespace = (query: string): string => {
  if (!query || typeof query !== 'string') return query;
  
  let result = '';
  let i = 0;
  const len = query.length;
  
  while (i < len) {
    const char = query[i];
    
    // Handle single-quoted strings
    if (char === "'") {
      result += char;
      i++;
      while (i < len) {
        result += query[i];
        if (query[i] === "'" && query[i + 1] === "'") {
          result += query[i + 1];
          i += 2;
        } else if (query[i] === "'") {
          i++;
          break;
        } else {
          i++;
        }
      }
      continue;
    }
    
    // Handle double-quoted identifiers
    if (char === '"') {
      result += char;
      i++;
      while (i < len) {
        result += query[i];
        if (query[i] === '"' && query[i + 1] === '"') {
          result += query[i + 1];
          i += 2;
        } else if (query[i] === '"') {
          i++;
          break;
        } else {
          i++;
        }
      }
      continue;
    }
    
    // Handle dollar-quoted strings
    if (char === '$') {
      let tag = '$';
      let j = i + 1;
      while (j < len && (query[j].match(/[a-zA-Z0-9_]/) || query[j] === '$')) {
        tag += query[j];
        if (query[j] === '$') {
          j++;
          break;
        }
        j++;
      }
      if (tag.endsWith('$') && tag.length >= 2) {
        result += tag;
        i = j;
        // Find closing tag
        const closeIdx = query.indexOf(tag, i);
        if (closeIdx !== -1) {
          result += query.slice(i, closeIdx + tag.length);
          i = closeIdx + tag.length;
        } else {
          result += query.slice(i);
          i = len;
        }
        continue;
      }
    }
    
    // Handle whitespace - collapse to single space
    if (/\s/.test(char)) {
      if (result.length > 0 && !result.endsWith(' ')) {
        result += ' ';
      }
      i++;
      while (i < len && /\s/.test(query[i])) {
        i++;
      }
      continue;
    }
    
    result += char;
    i++;
  }
  
  return result.trim();
};

export const transform = (obj: any, props: any): any => {
  let copy: any = null;
  if (obj == null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }

  if (obj instanceof Array) {
    copy = [];
    for (let i = 0, len = obj.length; i < len; i++) {
      copy[i] = transform(obj[i], props);
    }
    return copy;
  }

  if (obj instanceof Object || typeof obj === 'object') {
    copy = {};
    for (const attr in obj) {
      if (obj.hasOwnProperty(attr)) {
        let value: any;
        if (props.hasOwnProperty(attr)) {
          if (typeof props[attr] === 'function') {
            value = props[attr](obj[attr]);
          } else if (props[attr].hasOwnProperty(obj[attr])) {
            value = props[attr][obj[attr]];
          } else {
            value = transform(obj[attr], props);
          }
        } else {
          value = transform(obj[attr], props);
        }
        // Skip undefined values to normalize "missing vs present-but-undefined"
        if (value !== undefined) {
          copy[attr] = value;
        }
      } else {
        const value = transform(obj[attr], props);
        if (value !== undefined) {
          copy[attr] = value;
        }
      }
    }
    return copy;
  }

  throw new Error("Unable to copy obj! Its type isn't supported.");
};

export const cleanPlpgsqlTree = (tree: any) => {
  return transform(tree, {
    lineno: noop,
    location: noop,
    stmt_len: noop,
    stmt_location: noop,
    // varno values are assigned based on position in datums array and can change
    // when implicit variables (like sqlstate/sqlerrm) are filtered out during deparse
    varno: noop,
    query: normalizeQueryWhitespace,
  });
};

type ParseErrorType = 
  | 'PARSE_FAILED'
  | 'DEPARSE_FAILED'
  | 'RECONSTRUCT_FAILED'
  | 'REPARSE_FAILED'
  | 'AST_MISMATCH'
  | 'UNEXPECTED_ERROR';

interface ParseError extends Error {
  type: ParseErrorType;
  testName: string;
  sql: string;
  deparsedBody?: string;
  reconstructedSql?: string;
  originalAst?: any;
  reparsedAst?: any;
  parseError?: string;
}

function createParseError(
  type: ParseErrorType,
  testName: string,
  sql: string,
  deparsedBody?: string,
  reconstructedSql?: string,
  originalAst?: any,
  reparsedAst?: any,
  parseError?: string
): ParseError {
  const error = new Error(getErrorMessage(type)) as ParseError;
  error.type = type;
  error.testName = testName;
  error.sql = sql;
  error.deparsedBody = deparsedBody;
  error.reconstructedSql = reconstructedSql;
  error.originalAst = originalAst;
  error.reparsedAst = reparsedAst;
  error.parseError = parseError;
  return error;
}

function getErrorMessage(type: ParseErrorType): string {
  switch (type) {
    case 'PARSE_FAILED':
      return 'PL/pgSQL parse failed';
    case 'DEPARSE_FAILED':
      return 'PL/pgSQL deparse failed';
    case 'RECONSTRUCT_FAILED':
      return 'Failed to reconstruct SQL statement';
    case 'REPARSE_FAILED':
      return 'Reparse of reconstructed SQL failed';
    case 'AST_MISMATCH':
      return 'AST mismatch after parse/deparse cycle';
    case 'UNEXPECTED_ERROR':
      return 'Unexpected error during parse/deparse cycle';
  }
}

function extractBodyFromSql(sql: string): { body: string; prefix: string; suffix: string } | null {
  // Match tagged dollar quotes like $proc$, $body$, $func$, etc. or plain $$
  // The tag is optional: $tag$ or $$
  // We need to find the FIRST dollar quote and match it with the LAST occurrence of the same tag
  const dollarQuoteStartMatch = sql.match(/(\$[\w]*\$)/);
  if (!dollarQuoteStartMatch) {
    return null;
  }
  
  const tag = dollarQuoteStartMatch[1];
  const escapedTag = tag.replace(/\$/g, '\\$');
  
  // Find the first occurrence of the tag and the last occurrence
  const firstIndex = sql.indexOf(tag);
  const lastIndex = sql.lastIndexOf(tag);
  
  if (firstIndex === lastIndex) {
    // Only one occurrence - can't extract body
    return null;
  }
  
  return {
    prefix: sql.substring(0, firstIndex + tag.length),
    body: sql.substring(firstIndex + tag.length, lastIndex),
    suffix: sql.substring(lastIndex),
  };
}

function reconstructSql(originalSql: string, newBody: string): string {
  const parts = extractBodyFromSql(originalSql);
  if (!parts) {
    throw new Error('Could not extract body from SQL');
  }
  return parts.prefix + newBody + parts.suffix;
}

export class PLpgSQLTestUtils {
  protected printErrorMessage(sql: string, position: number) {
    const lineNumber = sql.slice(0, position).match(/\n/g)?.length || 0;
    const lines = sql.split('\n');
    let colNumber = position - 1;
    for (let l = 0; l < lineNumber; l++) {
      colNumber -= lines[l].length + 1;
    }
    const errMessage = [`Error line ${lineNumber + 1}, column ${colNumber + 1}`];
    if (lineNumber > 0) {
      errMessage.push(lines[lineNumber - 1]);
    }
    errMessage.push(lines[lineNumber]);
    errMessage.push(' '.repeat(Math.max(0, colNumber)) + '^');
    if (lineNumber < lines.length - 1) {
      errMessage.push(lines[lineNumber + 1]);
    }
    console.error(errMessage.join('\n'));
  }

  async parsePLpgSQL(sql: string): Promise<PLpgSQLParseResult> {
    const result = await parsePlPgSQL(sql);
    return result as unknown as PLpgSQLParseResult;
  }

  parsePLpgSQLSync(sql: string): PLpgSQLParseResult {
    const result = parsePlPgSQLSync(sql);
    return result as unknown as PLpgSQLParseResult;
  }

  async expectAstMatch(testName: string, sql: string) {
    let originalAst: any;
    
    try {
      originalAst = await this.parsePLpgSQL(sql);
      
      if (!originalAst.plpgsql_funcs || originalAst.plpgsql_funcs.length === 0) {
        throw createParseError('PARSE_FAILED', testName, sql);
      }

      const deparsedBody = deparseSync(originalAst);
      
      if (!deparsedBody || deparsedBody.trim().length === 0) {
        throw createParseError('DEPARSE_FAILED', testName, sql, deparsedBody);
      }

      let reconstructedSql: string;
      try {
        reconstructedSql = reconstructSql(sql, deparsedBody);
      } catch (err) {
        throw createParseError(
          'RECONSTRUCT_FAILED',
          testName,
          sql,
          deparsedBody,
          undefined,
          cleanPlpgsqlTree(originalAst),
          undefined,
          err instanceof Error ? err.message : String(err)
        );
      }

      let reparsedAst: any;
      try {
        reparsedAst = await this.parsePLpgSQL(reconstructedSql);
      } catch (parseErr) {
        throw createParseError(
          'REPARSE_FAILED',
          testName,
          sql,
          deparsedBody,
          reconstructedSql,
          cleanPlpgsqlTree(originalAst),
          undefined,
          parseErr instanceof Error ? parseErr.message : String(parseErr)
        );
      }

      const originalClean = cleanPlpgsqlTree(originalAst);
      const reparsedClean = cleanPlpgsqlTree(reparsedAst);

      try {
        expect(reparsedClean).toEqual(originalClean);
      } catch (err) {
        throw createParseError(
          'AST_MISMATCH',
          testName,
          sql,
          deparsedBody,
          reconstructedSql,
          originalClean,
          reparsedClean
        );
      }

      return { deparsedBody, reconstructedSql };
    } catch (err) {
      const errorMessages: string[] = [];
      
      if (err instanceof Error && 'type' in err) {
        const parseError = err as ParseError;
        errorMessages.push(`\n${parseError.type}: ${parseError.testName}`);
        errorMessages.push(`INPUT SQL: ${parseError.sql.substring(0, 200)}${parseError.sql.length > 200 ? '...' : ''}`);
        
        if (parseError.deparsedBody) {
          errorMessages.push(`DEPARSED BODY: ${parseError.deparsedBody.substring(0, 200)}${parseError.deparsedBody.length > 200 ? '...' : ''}`);
        }
        
        if (parseError.reconstructedSql) {
          errorMessages.push(`RECONSTRUCTED SQL: ${parseError.reconstructedSql.substring(0, 200)}${parseError.reconstructedSql.length > 200 ? '...' : ''}`);
        }
        
        if (parseError.type === 'AST_MISMATCH') {
          errorMessages.push(
            `\nAST COMPARISON:`,
            `EXPECTED AST:`,
            JSON.stringify(parseError.originalAst, null, 2).substring(0, 1000),
            `\nACTUAL AST:`,
            JSON.stringify(parseError.reparsedAst, null, 2).substring(0, 1000),
            `\nDIFF:`,
            diff(parseError.originalAst, parseError.reparsedAst) || 'No diff available'
          );
        } else if (parseError.parseError) {
          errorMessages.push(`PARSE ERROR: ${parseError.parseError}`);
        }
      } else {
        errorMessages.push(
          `\nUNEXPECTED ERROR: ${testName}`,
          `INPUT SQL: ${sql.substring(0, 200)}${sql.length > 200 ? '...' : ''}`,
          `ERROR: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      
      console.log(errorMessages.join('\n'));
      throw err;
    }
  }

  async expectParseDeparse(functionBody: string): Promise<string> {
    const parsed = await this.parsePLpgSQL(functionBody);
    
    if (!parsed.plpgsql_funcs || parsed.plpgsql_funcs.length === 0) {
      throw new Error('No PL/pgSQL functions found in parse result');
    }
    
    const deparsed = deparseSync(parsed);
    return deparsed;
  }

  expectParseDeparseSync(functionBody: string): string {
    const parsed = this.parsePLpgSQLSync(functionBody);
    
    if (!parsed.plpgsql_funcs || parsed.plpgsql_funcs.length === 0) {
      throw new Error('No PL/pgSQL functions found in parse result');
    }
    
    const deparsed = deparseSync(parsed);
    return deparsed;
  }

  async testFixture(testCase: PLpgSQLTestCase): Promise<{ success: boolean; deparsed?: string; error?: string }> {
    try {
      const deparsed = await this.expectParseDeparse(testCase.functionBody);
      return { success: true, deparsed };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : String(err) 
      };
    }
  }
}

export class FixtureTestUtils extends PLpgSQLTestUtils {
  private fixtures: Record<string, string>;

  constructor() {
    super();
    if (existsSync(GENERATED_JSON)) {
      this.fixtures = JSON.parse(readFileSync(GENERATED_JSON, 'utf-8'));
    } else {
      console.warn(`Generated fixtures not found at ${GENERATED_JSON}. Run 'npm run fixtures' first.`);
      this.fixtures = {};
    }
  }

  getFixtureCount(): number {
    return Object.keys(this.fixtures).length;
  }

  getTestEntries(filters: string[] = []): [string, string][] {
    if (filters.length === 0) {
      return Object.entries(this.fixtures);
    }
    return Object.entries(this.fixtures).filter(([relPath]) => 
      filters.some(f => relPath.includes(f))
    );
  }

  async runFixtureTests(filters: string[] = []) {
    const entries = this.getTestEntries(filters);
    if (entries.length === 0) {
      throw new Error('No fixtures found matching filters');
    }
    
    for (const [relativePath, sql] of entries) {
      await this.expectAstMatch(relativePath, sql);
    }
  }

  async runSingleFixture(key: string) {
    const sql = this.fixtures[key];
    if (!sql) {
      throw new Error(`Fixture not found: ${key}`);
    }
    return this.expectAstMatch(key, sql);
  }
}

export const testUtils = new PLpgSQLTestUtils();
export const fixtureTestUtils = new FixtureTestUtils();
export { PlpgsqlPrettyTest } from './PlpgsqlPrettyTest';
