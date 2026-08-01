#!/usr/bin/env ts-node
import { ParseResult, RawStmt } from '@pgsql/types';
import * as fs from 'fs';
import { sync as globSync } from 'glob';
import { parse } from 'libpg-query';
import * as path from 'path';

const FIXTURE_DIR = path.join(__dirname, '../../../__fixtures__/kitchen-sink');
const OUT_DIR = path.join(__dirname, '../__tests__/kitchen-sink');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(OUT_DIR);

const generateTestFile = (name: string, tests: string[]) => {
  return `
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('${name}', async () => {
  await fixtures.runFixtureTests(${JSON.stringify(tests, null, 2)});
});
`;
};

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

    const names = statements.stmts.map((stmt: RawStmt, idx: number) => {
      const outName = `${relPath.replace(/\.sql$/, '')}-${idx + 1}.sql`;
      return outName;
    });

    const testFileName = relPath.replace(/\//g, '-').replace(/\.sql$/, '');
    const testFile = generateTestFile(testFileName, names);
    fs.writeFileSync(path.join(OUT_DIR, `${testFileName}.test.ts`), testFile);
  }
}

main().catch(console.error);
