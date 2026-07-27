import { Parser } from '@pgsql/parser';
import { parse as parse18 } from 'libpg-query';
import { cleanTree } from './clean-tree';
import { readFileSync } from 'fs';
import * as path from 'path';
import { diff } from 'jest-diff';
import { skipTests } from './skip-tests';
const parser13 = new Parser({ version: 13 });
const parser14 = new Parser({ version: 14 });
const parser15 = new Parser({ version: 15 });
const parser16 = new Parser({ version: 16 });
const parser17 = new Parser({ version: 17 });
// @pgsql/parser does not ship a v18 build yet; use libpg-query@18 directly
const parser18 = { parse: (sql: string) => parse18(sql) };

import { ASTTransformer } from '../src/multi-version-transformer';

/**
 * Get the appropriate parsers for version transformation
 */
export function getParsersForVersions(versionPrevious: number, versionNext: number): { parserPrevious: any, parserNext: any } {
  if (versionNext - versionPrevious !== 1) {
    throw new Error('Version difference must be 1');
  }

  let parserPrevious;
  let parserNext;
  
  switch (versionPrevious) {
    case 13:
      parserPrevious = parser13;
      parserNext = parser14;
      break;
    case 14:
      parserPrevious = parser14;
      parserNext = parser15;
      break;
    case 15:
      parserPrevious = parser15;
      parserNext = parser16;
      break;
    case 16:
      parserPrevious = parser16;
      parserNext = parser17;
      break;
    case 17:
      parserPrevious = parser17;
      parserNext = parser18;
      break;
    default:
      throw new Error('Unsupported version');
  }

  return { parserPrevious, parserNext };
}

/**
 * Get the appropriate transformer for version transformation
 */
export function getTransformerForVersion(versionPrevious: number, versionNext: number): ASTTransformer {
  // Return a single ASTTransformer instance that can handle all transformations
  return new ASTTransformer();
}

/**
 * Perform the parse-transform-parse equality test
 */
export async function expectTransformedAstToEqualParsedAst(
  sql: string,
  parserPrevious: any,
  parserNext: any,
  transformer: ASTTransformer,
  versionPrevious: number,
  versionNext: number,
  relativePath?: string
): Promise<void> {
  const parsedPrevious = await parserPrevious.parse(sql);
  const parsedNext = await parserNext.parse(sql);
  
  // Create a copy of the previous AST to transform
  const astToTransform = JSON.parse(JSON.stringify(parsedPrevious));
  
  // Transform the statements within the AST
  if (astToTransform.stmts && Array.isArray(astToTransform.stmts)) {
    astToTransform.stmts = astToTransform.stmts.map((stmtWrapper: any, index: number) => {
      if (stmtWrapper.stmt) {
        try {
          // Transform the actual statement using the ASTTransformer
          const transformedStmt = transformer.transform(stmtWrapper.stmt, versionPrevious, versionNext);
          return { ...stmtWrapper, stmt: transformedStmt };
        } catch (error: any) {
          const errorMessage = [
            `\n❌ TRANSFORMATION ERROR ${relativePath ? `(${relativePath})` : ''}`,
            `   ⚠️ Previous Version: ${versionPrevious}`,
            `   ⚠️ Next Version: ${versionNext}`,
            `   ⚠️ Statement Index: ${index}`,
            `   ⚠️ Statement Type: ${Object.keys(stmtWrapper.stmt)[0]}`,
            `   ⚠️ Error: ${error.message}`,
            `\n   ⚠️ Original Statement:`,
            JSON.stringify(stmtWrapper.stmt, null, 2)
          ].join('\n');
          
          console.error(errorMessage);
          throw error;
        }
      }
      return stmtWrapper;
    });
  }
  
  // Update the version to match the target version
  astToTransform.version = parsedNext.version;
  
  const nextAst = cleanTree(parsedNext);
  const previousTransformedAst = cleanTree(astToTransform);
  
  // Remove version fields for comparison
  delete nextAst.version;
  delete previousTransformedAst.version;
  
  try {
    expect(nextAst).toEqual(previousTransformedAst);
  } catch (error: any) {
    // Try to find the first difference
    const d = diff(nextAst, previousTransformedAst);
    
    const errorMessage = [
      `\n❌ TRANSFORMATION MISMATCH ${relativePath ? `(${relativePath})` : ''}`,
      `   ⚠️ Previous Version: ${versionPrevious}`,
      `   ⚠️ Next Version: ${versionNext}`,
      `   ⚠️ SQL: ${sql}`,
      `\n   ⚠️ Expected (parsed with v${versionNext}):`,
      JSON.stringify(nextAst, null, 2),
      `\n   ⚠️ Actual (transformed from v${versionPrevious}):`,
      JSON.stringify(previousTransformedAst, null, 2)
    ].filter(line => line !== '').join('\n');
    console.log(relativePath + ':\n' + d);
    console.error(errorMessage);
    throw error;
  }
}

/**
 * Combined helper that uses all three modular functions
 */
export async function expectParseTransformParseToBeEqual(sql: string, versionPrevious: number, versionNext: number) {
  const { parserPrevious, parserNext } = getParsersForVersions(versionPrevious, versionNext);
  const transformer = getTransformerForVersion(versionPrevious, versionNext);
  
  await expectTransformedAstToEqualParsedAst(sql, parserPrevious, parserNext, transformer, versionPrevious, versionNext);
}

export class FixtureTestUtils {
  private fixtures: Record<string, string>;
  versionPrevious: number;
  versionNext: number;

  transformer: ASTTransformer;
  parserPrevious: any;
  parserNext: any;

  constructor(versionPrevious: number, versionNext: number) {
    if (versionNext - versionPrevious !== 1) {
      throw new Error('Version difference must be 1');
    }
    this.versionNext = versionNext;
    this.versionPrevious = versionPrevious;

    // Use the modular helper functions
    this.transformer = getTransformerForVersion(versionPrevious, versionNext);
    const { parserPrevious, parserNext } = getParsersForVersions(versionPrevious, versionNext);
    this.parserPrevious = parserPrevious;
    this.parserNext = parserNext;

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

  async expectParseTransformParseToBeEqual(relativePath: string, sql: string) {
    // Use the modular helper function instead of duplicating logic
    await expectTransformedAstToEqualParsedAst(sql, this.parserPrevious, this.parserNext, this.transformer, this.versionPrevious, this.versionNext, relativePath);
  }

  async runFixtureTests(filters: string[]) {
    if (filters.length === 0) {
      console.log('no filters provided, skipping tests.');
      return;
    }
    
    const entries = this.getTestEntries(filters);
    for (const [relativePath, sql] of entries) {
      // Check if this test should be skipped
      const skipEntry = skipTests.find(([versionPrevious, versionNext, test, reason]) => 
        versionPrevious === this.versionPrevious && 
        versionNext === this.versionNext && 
        test === relativePath
      );
      
      if (skipEntry) {
        console.log(`⏭️  SKIPPING: ${relativePath} - ${skipEntry[3]}`);
        continue;
      }
      
      try {
        await this.expectParseTransformParseToBeEqual(relativePath, sql);
      } catch (error: any) {
        console.error(`\n❌ FAILED: ${relativePath}`);
        throw error;
      }
    }
  }
}

// Re-export the full transform flow utilities
export { FullTransformFlowFixture } from './full-transform-flow';
