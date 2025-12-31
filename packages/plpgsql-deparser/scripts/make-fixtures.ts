#!/usr/bin/env ts-node
import * as path from 'path';
import * as fs from 'fs';
import { sync as globSync } from 'glob';
import { parse } from 'libpg-query';
import { parsePlPgSQLSync, loadModule } from '@libpg-query/parser';

const FIXTURE_DIR = path.join(__dirname, '../../../__fixtures__/plpgsql');
const OUT_DIR = path.join(__dirname, '../../../__fixtures__/plpgsql-generated');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

interface ExtractedStatement {
  statement: string;
  index: number;
  location?: number;
  length?: number;
}

function extractStatement(
  originalSQL: string,
  stmtLocation: number | undefined,
  stmtLen: number | undefined,
  isFirst: boolean = false
): string | null {
  const sqlBuffer = Buffer.from(originalSQL, 'utf8');
  let extracted: string | null = null;

  if (stmtLocation !== undefined && stmtLen !== undefined) {
    const startByte = stmtLocation;
    const endByte = stmtLocation + stmtLen;
    const extractedBuffer = sqlBuffer.slice(startByte, endByte);
    extracted = extractedBuffer.toString('utf8');
  } else if (stmtLocation !== undefined && stmtLen === undefined) {
    const extractedBuffer = sqlBuffer.slice(stmtLocation);
    extracted = extractedBuffer.toString('utf8');
  } else if (isFirst && stmtLen !== undefined) {
    const extractedBuffer = sqlBuffer.slice(0, stmtLen);
    extracted = extractedBuffer.toString('utf8');
  } else if (isFirst && stmtLocation === undefined && stmtLen === undefined) {
    extracted = originalSQL;
  }

  if (extracted) {
    extracted = extracted.trim();
  }

  return extracted;
}

function isPLpgSQLStatement(stmt: any): boolean {
  if ('CreateFunctionStmt' in stmt) {
    const options = stmt.CreateFunctionStmt.options || [];
    for (const opt of options) {
      if ('DefElem' in opt && opt.DefElem.defname === 'language') {
        const lang = opt.DefElem.arg?.String?.sval?.toLowerCase();
        if (lang === 'plpgsql') {
          return true;
        }
      }
    }
  }
  if ('DoStmt' in stmt) {
    return true;
  }
  return false;
}

function generateStatementKey(relativePath: string, statementIndex: number): string {
  return `${relativePath.replace(/\.sql$/, '')}-${statementIndex + 1}.sql`;
}

async function main() {
  await loadModule();
  
  ensureDir(OUT_DIR);

  const fixtures = globSync(path.join(FIXTURE_DIR, '**/*.sql'));
  const results: Record<string, string> = {};
  let totalStatements = 0;
  let validStatements = 0;
  let skippedStatements = 0;

  console.log(`Found ${fixtures.length} fixture files`);

  for (const fixturePath of fixtures) {
    const relPath = path.relative(FIXTURE_DIR, fixturePath);
    const sql = fs.readFileSync(fixturePath, 'utf-8');

    try {
      const parseResult = await parse(sql);
      
      if (!parseResult.stmts) {
        continue;
      }

      let stmtIndex = 0;
      for (let idx = 0; idx < parseResult.stmts.length; idx++) {
        const rawStmt = parseResult.stmts[idx];
        const stmt = rawStmt.stmt;

        if (!isPLpgSQLStatement(stmt)) {
          continue;
        }

        totalStatements++;

        const extracted = extractStatement(
          sql,
          rawStmt.stmt_location,
          rawStmt.stmt_len,
          idx === 0
        );

        if (!extracted) {
          console.error(`Failed to extract statement ${idx} from ${relPath}`);
          skippedStatements++;
          continue;
        }

        try {
          parsePlPgSQLSync(extracted);
          
          const key = generateStatementKey(relPath, stmtIndex);
          results[key] = extracted;
          validStatements++;
          stmtIndex++;
        } catch (parseErr: any) {
          console.warn(`Skipping ${relPath}:${idx} - PL/pgSQL parse failed: ${parseErr.message}`);
          skippedStatements++;
        }
      }
    } catch (err: any) {
      console.error(`Failed to parse ${relPath}:`, err.message);
      continue;
    }
  }

  const outputFile = path.join(OUT_DIR, 'generated.json');
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  
  console.log(`\nFixture generation complete:`);
  console.log(`  Total PL/pgSQL statements found: ${totalStatements}`);
  console.log(`  Valid statements (parseable): ${validStatements}`);
  console.log(`  Skipped statements: ${skippedStatements}`);
  console.log(`  Output: ${outputFile}`);
}

main().catch(console.error);
