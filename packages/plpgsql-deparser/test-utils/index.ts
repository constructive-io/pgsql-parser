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
        if (props.hasOwnProperty(attr)) {
          if (typeof props[attr] === 'function') {
            copy[attr] = props[attr](obj[attr]);
          } else if (props[attr].hasOwnProperty(obj[attr])) {
            copy[attr] = props[attr][obj[attr]];
          } else {
            copy[attr] = transform(obj[attr], props);
          }
        } else {
          copy[attr] = transform(obj[attr], props);
        }
      } else {
        copy[attr] = transform(obj[attr], props);
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
  const dollarQuoteMatch = sql.match(/^([\s\S]*?\$\$)([\s\S]*?)(\$\$[\s\S]*)$/);
  if (dollarQuoteMatch) {
    return {
      prefix: dollarQuoteMatch[1],
      body: dollarQuoteMatch[2],
      suffix: dollarQuoteMatch[3],
    };
  }
  return null;
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
