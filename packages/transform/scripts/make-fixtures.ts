/**
 * Regenerate the expected output fixtures from the input fixtures.
 *
 * Usage (from packages/transform):
 *   pnpm fixtures
 *
 * For each file in __fixtures__/input/, runs transform_sql with the default
 * my-schema/other-schema mapping (matching __tests__/transform.test.ts) and
 * writes the result to __fixtures__/output/<same-name>.
 *
 * Review the diff of __fixtures__/output/ before committing — the output is
 * the golden file the kitchen-sink test asserts against.
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadModule } from 'plpgsql-parser';

import {
  transformJsonStringValues,
  transformSql,
  TransformSqlOptions,
} from '../src';

const FIXTURES_DIR = path.resolve(__dirname, '..', '__fixtures__');
const INPUT_DIR = path.join(FIXTURES_DIR, 'input');
const OUTPUT_DIR = path.join(FIXTURES_DIR, 'output');

const DEFAULT_MAPPING = new Map<string, string>([
  ['my-schema', 'my_schema'],
  ['other-schema', 'other_schema'],
]);

async function main() {
  await loadModule();

  const opts: TransformSqlOptions = {
    prePasses: [transformJsonStringValues],
  };

  for (const file of fs.readdirSync(INPUT_DIR)) {
    if (!file.endsWith('.sql')) continue;
    const input = fs.readFileSync(path.join(INPUT_DIR, file), 'utf8');
    const { content, result } = transformSql(input, DEFAULT_MAPPING, opts);
    if (result.errors.length > 0) {
      console.error(`Errors transforming ${file}:`, result.errors);
      process.exitCode = 1;
      continue;
    }
    fs.writeFileSync(path.join(OUTPUT_DIR, file), content);
    console.log(`Wrote __fixtures__/output/${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
