/**
 * Round-trips the PL/pgSQL functions and DO blocks of the PostgreSQL regression corpus
 * (__fixtures__/regress/statements.json.gz, built by `npm run fixtures:regress` in
 * packages/deparser) through parse -> deparse -> parse.
 *
 * known-failures.plpgsql-deparser.json is a ratchet: a new failure fails the test, and so
 * does a listed statement that now passes. After a deliberate change, refresh it with
 *   UPDATE_KNOWN_FAILURES=1 npx jest __tests__/regress-corpus
 */
import * as fs from 'fs';
import { loadModule, parsePlPgSQLSync } from 'libpg-query';
import * as path from 'path';
import * as zlib from 'zlib';

import { PLpgSQLTestUtils } from '../test-utils';

const FIXTURE_DIR = path.join(__dirname, '../../../__fixtures__/regress');
const KNOWN_FAILURES_FILE = path.join(FIXTURE_DIR, 'known-failures.plpgsql-deparser.json');
const UPDATE = process.env.UPDATE_KNOWN_FAILURES === '1';

const { statements } = JSON.parse(
  zlib.gunzipSync(fs.readFileSync(path.join(FIXTURE_DIR, 'statements.json.gz'))).toString('utf8')
) as { statements: Record<string, string> };
const knownFailures: string[] = JSON.parse(fs.readFileSync(KNOWN_FAILURES_FILE, 'utf8'));

const candidates = Object.keys(statements).filter((key) =>
  /language\s+'?plpgsql|^\s*do\s/i.test(statements[key])
);

describe('regress corpus PL/pgSQL round-trip', () => {
  const utils = new PLpgSQLTestUtils();

  beforeAll(async () => {
    await loadModule();
    for (const level of ['error', 'warn', 'log'] as const) jest.spyOn(console, level).mockImplementation(() => {});
  });
  afterAll(() => jest.restoreAllMocks());

  it('matches known failures', async () => {
    const failing: string[] = [];
    let tested = 0;
    for (const key of candidates) {
      try {
        const parsed = parsePlPgSQLSync(statements[key]) as any;
        if (!parsed.plpgsql_funcs?.length) continue;
      } catch {
        continue;
      }
      tested++;
      try {
        await utils.expectAstMatch(key, statements[key]);
      } catch {
        failing.push(key);
      }
    }
    expect(tested).toBeGreaterThan(500);
    if (UPDATE) {
      fs.writeFileSync(KNOWN_FAILURES_FILE, JSON.stringify(failing, null, 2) + '\n');
    } else {
      expect(failing).toEqual(knownFailures);
    }
  });
});
