import { readFileSync } from 'fs';
import { diff } from 'jest-diff';
import { parse } from 'libpg-query';
import * as path from 'path';

import { cleanTree } from '../scripts/clean-utils';
import { DeparserOptions,deparseSync as deparse } from '../src';

export async function expectParseDeparse(sql1: string, options: DeparserOptions = { pretty: false }) {
  const parsed = await parse(sql1);
  
  const sql2 = deparse(parsed, options);
  
  const ast1 = cleanTree(parsed);
  const ast2 = cleanTree(await parse(sql2));
  
  expect(ast2).toEqual(ast1);
  
  return sql2;
}

type ParseErrorType = 
  | 'PARSE_FAILED'
  | 'INVALID_STATEMENT'
  | 'REPARSE_FAILED'
  | 'AST_MISMATCH'
  | 'UNEXPECTED_ERROR'
  | 'INVALID_DEPARSED_SQL'
  | 'PRETTY_INVALID_DEPARSED_SQL'
  | 'PRETTY_REPARSE_FAILED'
  | 'PRETTY_AST_MISMATCH';

interface ParseError extends Error {
  type: ParseErrorType;
  testName: string;
  sql: string;
  deparsedSql?: string;
  originalAst?: any;
  reparsedAst?: any;
  parseError?: string;
}

function createParseError(
  type: ParseErrorType,
  testName: string,
  sql: string,
  deparsedSql?: string,
  originalAst?: any,
  reparsedAst?: any,
  parseError?: string
): ParseError {
  const error = new Error(getErrorMessage(type)) as ParseError;
  error.type = type;
  error.testName = testName;
  error.sql = sql;
  error.deparsedSql = deparsedSql;
  error.originalAst = originalAst;
  error.reparsedAst = reparsedAst;
  error.parseError = parseError;
  return error;
}

function getErrorMessage(type: ParseErrorType): string {
  switch (type) {
  case 'PARSE_FAILED':
    return 'Parse failed - no statements returned';
  case 'INVALID_STATEMENT':
    return 'Invalid statement structure';
  case 'REPARSE_FAILED':
    return 'Reparse failed - no statements returned';
  case 'AST_MISMATCH':
    return 'AST mismatch after parse/deparse cycle';
  case 'UNEXPECTED_ERROR':
    return 'Unexpected error during parse/deparse cycle';
  case 'INVALID_DEPARSED_SQL':
    return 'Invalid deparsed SQL';
  case 'PRETTY_INVALID_DEPARSED_SQL':
    return 'Invalid deparsed SQL (pretty)';
  case 'PRETTY_REPARSE_FAILED':
    return 'Reparse failed - no statements returned (pretty)';
  case 'PRETTY_AST_MISMATCH':
    return 'AST mismatch after parse/deparse cycle (pretty)';
  }
}

export class TestUtils {
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
    errMessage.push(' '.repeat(colNumber) + '^');
    if (lineNumber < lines.length - 1) {
      errMessage.push(lines[lineNumber + 1]);
    }
    console.error(errMessage.join('\n'));
  }

  async tryParse(sql: string) {
    try {
      return await parse(sql);
    } catch (err: any) {
      if (err.cursorPosition) {
        this.printErrorMessage(sql, err.cursorPosition);
      }
      throw err;
    }
  }

  async expectAstMatch(testName: string, sql: string) {
    let tree: any;
    try {
      tree = await this.tryParse(sql);
      if (tree.stmts) {
        for (const stmt of tree.stmts) {
          if (stmt.stmt) {
            const outSql1 = deparse(stmt.stmt, { pretty: false });
            const outSql2 = deparse(stmt.stmt, { pretty: true });
            
            // console.log(`\n🔍 DEBUGGING SQL COMPARISON for test: ${testName}`);
            // console.log(`📥 INPUT SQL: ${sql}`);
            // console.log(`📤 DEPARSED SQL: ${outSql}`);
            // console.log(`🔄 SQL MATCH: ${sql.trim() === outSql.trim() ? '✅ EXACT MATCH' : '❌ DIFFERENT'}`);
            
            // Test non-pretty version first
            let reparsed;
            try {
              reparsed = await parse(outSql1);
            } catch (parseErr) {
              throw createParseError(
                'INVALID_DEPARSED_SQL',
                testName,
                sql,
                outSql1,
                cleanTree([stmt]),
                undefined,
                parseErr instanceof Error ? parseErr.message : String(parseErr)
              );
            }
            
            const originalClean = cleanTree([stmt]);
            const reparsedClean = cleanTree(reparsed.stmts || []);
            
            if (!tree.stmts) {
              throw createParseError('PARSE_FAILED', testName, sql);
            }
            
            if (!stmt.stmt) {
              throw createParseError('INVALID_STATEMENT', testName, sql, undefined, cleanTree(tree));
            }
            
            if (!reparsed.stmts) {
              throw createParseError('REPARSE_FAILED', testName, sql, outSql1, originalClean);
            }
            
            try {
              expect(reparsedClean).toEqual(originalClean);
            } catch (err) {
              throw createParseError('AST_MISMATCH', testName, sql, outSql1, originalClean, reparsedClean);
            }

            // Test pretty version if non-pretty succeeded
            let prettyReparsed;
            try {
              prettyReparsed = await parse(outSql2);
            } catch (parseErr) {
              throw createParseError(
                'PRETTY_INVALID_DEPARSED_SQL',
                testName,
                sql,
                outSql2,
                cleanTree([stmt]),
                undefined,
                parseErr instanceof Error ? parseErr.message : String(parseErr)
              );
            }
            
            const prettyReparsedClean = cleanTree(prettyReparsed.stmts || []);
            
            if (!prettyReparsed.stmts) {
              throw createParseError('PRETTY_REPARSE_FAILED', testName, sql, outSql2, originalClean);
            }
            
            try {
              expect(prettyReparsedClean).toEqual(originalClean);
            } catch (err) {
              throw createParseError('PRETTY_AST_MISMATCH', testName, sql, outSql2, originalClean, prettyReparsedClean);
            }
          }
        }
      }
    } catch (err) {
      const errorMessages: string[] = [];
      
      if (err instanceof Error && 'type' in err) {
        const parseError = err as ParseError;
        errorMessages.push(`\n❌ ${parseError.type}: ${parseError.testName}`);
        errorMessages.push(`❌ INPUT SQL: ${parseError.sql}`);
        
        if (parseError.deparsedSql) {
          errorMessages.push(`❌ DEPARSED SQL: ${parseError.deparsedSql}`);
        }
        
        if (parseError.type === 'INVALID_DEPARSED_SQL') {
          errorMessages.push(
            `\n❌ DEPARSER GENERATED INVALID SQL:`,
            `ORIGINAL AST:`,
            JSON.stringify(parseError.originalAst, null, 2),
            `\nPARSE ERROR: ${parseError.parseError}`
          );
        } else if (parseError.type === 'AST_MISMATCH') {
          errorMessages.push(
            `\n❌ AST COMPARISON:`,
            `EXPECTED AST:`,
            JSON.stringify(parseError.originalAst, null, 2),
            `\nACTUAL AST:`,
            JSON.stringify(parseError.reparsedAst, null, 2),
            `\nDIFF (what's missing from actual vs expected):`,
            diff(parseError.originalAst, parseError.reparsedAst) || 'No diff available'
          );
        } else if (parseError.type === 'PRETTY_INVALID_DEPARSED_SQL') {
          errorMessages.push(
            `\n❌ PRETTY DEPARSER GENERATED INVALID SQL:`,
            `ORIGINAL AST:`,
            JSON.stringify(parseError.originalAst, null, 2),
            `\nPARSE ERROR: ${parseError.parseError}`
          );
        } else if (parseError.type === 'PRETTY_AST_MISMATCH') {
          errorMessages.push(
            `\n❌ PRETTY AST COMPARISON:`,
            `EXPECTED AST:`,
            JSON.stringify(parseError.originalAst, null, 2),
            `\nACTUAL AST:`,
            JSON.stringify(parseError.reparsedAst, null, 2),
            `\nDIFF (what's missing from actual vs expected):`,
            diff(parseError.originalAst, parseError.reparsedAst) || 'No diff available'
          );
        } else if (parseError.originalAst) {
          errorMessages.push(`❌ AST: ${JSON.stringify(parseError.originalAst, null, 2)}`);
        }
      } else {
        // Handle unexpected errors
        errorMessages.push(
          `\n❌ UNEXPECTED ERROR: ${testName}`,
          `❌ INPUT SQL: ${sql}`,
          `❌ ERROR: ${err instanceof Error ? err.message : String(err)}`
        );
        if (tree) {
          errorMessages.push(`❌ PARSED AST: ${JSON.stringify(cleanTree(tree), null, 2)}`);
        }
      }
      
      console.log(errorMessages.join('\n'));
      throw err;
    }
  }
}

export class FixtureTestUtils extends TestUtils {
  private fixtures: Record<string, string>;

  constructor() {
    super();
    const GENERATED_JSON = path.join(__dirname, '../../../__fixtures__/generated/generated.json');
    this.fixtures = JSON.parse(readFileSync(GENERATED_JSON, 'utf-8'));
  }

  getTestEntries(filters: string[]) {
    if (filters.length === 0) {
      return Object.entries(this.fixtures);
    }
    return Object.entries(this.fixtures).filter(([relPath]) => 
      filters.includes(relPath)
    );
  }

  async runFixtureTests(filters: string[]) {
    if (filters.length === 0) {
      console.log('no filters provided, skipping tests.');
      return;
    }
    const entries = this.getTestEntries(filters);
    for (const [relativePath, sql] of entries) {
      await this.expectAstMatch(relativePath, sql);
    }
  }
}
