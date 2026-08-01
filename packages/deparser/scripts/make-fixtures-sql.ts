#!/usr/bin/env ts-node
import { ParseResult } from '@pgsql/types';
import * as fs from 'fs';
import { sync as globSync } from 'glob';
import { deparse,parse } from 'libpg-query';
import * as path from 'path';

const FIXTURE_DIR = path.join(__dirname, '../../../__fixtures__/legacy');
const OUT_DIR = path.join(__dirname, '../../../__fixtures__/generated');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(OUT_DIR);

const fixtures = globSync(path.join(FIXTURE_DIR, '**/*.sql'));

async function main() {
  for (const fixturePath of fixtures) {
    const relPath = path.relative(FIXTURE_DIR, fixturePath);
    const sql = fs.readFileSync(fixturePath, 'utf-8');
    let statements: ParseResult;
    try {
      statements = await parse(sql);
    } catch (err: any) {
      console.error(`Failed to parse ${relPath}:`, err);
      continue;
    }

    for (let idx = 0; idx < statements.stmts.length; idx++) {
      const stmt = statements.stmts[idx];
      const outDir = path.join(OUT_DIR, path.dirname(relPath));
      ensureDir(outDir);
      const base = path.basename(relPath, '.sql');
      const outName = `${base}-${idx + 1}.sql`;
      const outPath = path.join(outDir, outName);
      let deparsedSql: string;
      try {
        deparsedSql = await deparse({
          version: 170000,
          stmts: [stmt]
        });
      } catch (err: any) {
        console.error(`Failed to deparse statement ${idx + 1} in ${relPath}:`, err);
        continue;
      }
      fs.writeFileSync(outPath, deparsedSql);
      console.log(`Generated ${outPath}`);
    }
  }
}

main().catch(console.error);
