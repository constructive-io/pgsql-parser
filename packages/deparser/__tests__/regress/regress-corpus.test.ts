/**
 * Round-trips the PostgreSQL regression corpus (__fixtures__/regress/statements.json.gz,
 * built by `npm run fixtures:regress`) through parse -> deparse -> parse, pretty and not.
 *
 * known-failures.deparser.json is a ratchet: a new failure fails the test, and so does a listed
 * statement that now passes. After a deliberate change, refresh it with
 *   UPDATE_KNOWN_FAILURES=1 npx jest __tests__/regress
 */
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

import { TestUtils } from '../../test-utils';

const FIXTURE_DIR = path.join(__dirname, '../../../../__fixtures__/regress');
const KNOWN_FAILURES_FILE = path.join(FIXTURE_DIR, 'known-failures.deparser.json');
const UPDATE = process.env.UPDATE_KNOWN_FAILURES === '1';

const { statements } = JSON.parse(
  zlib.gunzipSync(fs.readFileSync(path.join(FIXTURE_DIR, 'statements.json.gz'))).toString('utf8')
) as { statements: Record<string, string> };
const knownFailures: Record<string, string[]> = JSON.parse(fs.readFileSync(KNOWN_FAILURES_FILE, 'utf8'));

const byFile = new Map<string, string[]>();
for (const key of Object.keys(statements)) {
  const file = key.replace(/-\d+\.sql$/, '.sql');
  byFile.set(file, [...(byFile.get(file) ?? []), key]);
}

const observed: Record<string, string[]> = {};
const utils = new TestUtils();

describe('regress corpus round-trip', () => {
  beforeAll(() => {
    for (const level of ['error', 'warn', 'log'] as const) jest.spyOn(console, level).mockImplementation(() => {});
  });
  afterAll(() => {
    jest.restoreAllMocks();
    if (UPDATE) {
      const sorted = Object.fromEntries(Object.entries(observed).sort(([a], [b]) => a.localeCompare(b)));
      fs.writeFileSync(KNOWN_FAILURES_FILE, JSON.stringify(sorted, null, 2) + '\n');
    }
  });

  it.each([...byFile.keys()])('%s', async (file) => {
    const failing: string[] = [];
    for (const key of byFile.get(file)!) {
      try {
        await utils.expectAstMatch(key, statements[key]);
      } catch {
        failing.push(key);
      }
    }
    if (failing.length) observed[file] = failing;
    if (!UPDATE) expect(failing).toEqual(knownFailures[file] ?? []);
  });
});
