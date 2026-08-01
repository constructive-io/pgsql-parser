#!/usr/bin/env ts-node
import * as fs from 'fs';
import { sync as globSync } from 'glob';
import { deparse,parse } from 'libpg-query';
import * as path from 'path';

import { deparse as ourDeparse } from '../src';
import { cleanTree } from './clean-utils';
import { generateStatementKey,splitStatements } from './statement-splitter';

const FIXTURE_DIR = path.join(__dirname, '../../../__fixtures__/kitchen-sink');
const OUT_DIR = path.join(__dirname, '../../../__fixtures__/generated');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(OUT_DIR);

const fixtures = globSync(path.join(FIXTURE_DIR, '**/*.sql'));

async function main() {
  // Collect only files with differences between deparsers
  const results: Record<string, { upstream?: string; deparsed?: string; original: string }> = {};
  
  for (const fixturePath of fixtures) {
    const relPath = path.relative(FIXTURE_DIR, fixturePath);
    const sql = fs.readFileSync(fixturePath, 'utf-8');
    
    try {
      const statements = await splitStatements(sql);
      
      for (const stmt of statements) {
        // We need the original statement to get the RawStmt for deparsing
        const parseResult = await parse(sql);
        const rawStmt = parseResult.stmts[stmt.index];
        
        // Get source of truth: cleanTree(parse(original))
        let sourceOfTruthAst: any;
        try {
          const originalParsed = await parse(stmt.statement);
          sourceOfTruthAst = cleanTree(originalParsed.stmts?.[0]?.stmt);
        } catch (err: any) {
          console.error(`Failed to parse original SQL for statement ${stmt.index + 1} in ${relPath}:`, err);
          continue;
        }
        
        // Get upstream deparse and its AST
        let upstreamSql: string | undefined;
        let upstreamAst: any;
        try {
          upstreamSql = await deparse({ version: 170000, stmts: [rawStmt] });
          const upstreamParsed = await parse(upstreamSql);
          upstreamAst = cleanTree(upstreamParsed.stmts?.[0]?.stmt);
        } catch (err: any) {
          console.error(`Failed to process upstream deparse for statement ${stmt.index + 1} in ${relPath}:`, err);
          continue;
        }
        
        // Get our deparse and its AST
        let ourDeparsedSql: string | undefined;
        let ourAst: any;
        let ourDeParseError = false;
        try {
          ourDeparsedSql = ourDeparse(rawStmt.stmt);
          const ourParsed = await parse(ourDeparsedSql);
          ourAst = cleanTree(ourParsed.stmts?.[0]?.stmt);
        } catch (err: any) {
          console.error(`Failed to process our deparse for statement ${stmt.index + 1} in ${relPath}:`, err);
          ourDeParseError = true;
          // Keep ourDeparsedSql so we can still show it in results even if it doesn't parse
        }
        
        // Compare ASTs to source of truth only
        const upstreamMatches = JSON.stringify(upstreamAst) === JSON.stringify(sourceOfTruthAst);
        const ourMatches = ourAst ? JSON.stringify(ourAst) === JSON.stringify(sourceOfTruthAst) : false;
        
        
        // Only include if either deparser differs from original OR our deparser failed to parse
        if (!upstreamMatches || !ourMatches || ourDeParseError) {
          const key = generateStatementKey(relPath, stmt.index);
          results[key] = {
            original: stmt.statement,
            // Show upstream only if it differs from original
            ...(!upstreamMatches && upstreamSql && { upstream: upstreamSql }),
            // Show our deparser if it differs from original OR if it failed to parse (both indicate issues)
            ...((!ourMatches || ourDeParseError) && ourDeparsedSql && { deparsed: ourDeparsedSql })
          };
        }
      }
    } catch (err: any) {
      console.error(`Failed to parse ${relPath}:`, err);
      continue;
    }
  }

  // Write aggregated JSON to output file
  const outputFile = path.join(OUT_DIR, 'upstream-diff.json');
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`Wrote JSON to ${outputFile}`);
}

main().catch(console.error);
