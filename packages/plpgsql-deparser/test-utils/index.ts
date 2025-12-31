import { parsePlPgSQL, parsePlPgSQLSync } from '@libpg-query/parser';
import { deparseSync, PLpgSQLParseResult } from '../src';
import { readFileSync, readdirSync } from 'fs';
import * as path from 'path';

const PLPGSQL_FIXTURES_DIR = path.join(__dirname, '../../../__fixtures__/plpgsql');

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

export class PLpgSQLTestUtils {
  async parsePLpgSQL(functionBody: string): Promise<PLpgSQLParseResult> {
    const result = await parsePlPgSQL(functionBody);
    return result as unknown as PLpgSQLParseResult;
  }

  parsePLpgSQLSync(functionBody: string): PLpgSQLParseResult {
    const result = parsePlPgSQLSync(functionBody);
    return result as unknown as PLpgSQLParseResult;
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

export const testUtils = new PLpgSQLTestUtils();
