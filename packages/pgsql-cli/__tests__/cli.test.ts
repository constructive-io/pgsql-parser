import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { deparseCommand } from '../src/commands/deparse';
import { parseCommand } from '../src/commands/parse';

const sql = `SELECT (ARRAY[1, 2, 3])[2:3] AS slice, 'line one
line two' AS memo FROM t WHERE id = 1`;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pgsql-cli-'));
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

const parseToFile = async (input: string, format?: string) => {
  const sqlFile = join(dir, 'in.sql');
  const astFile = join(dir, `ast-${format ?? 'default'}.json`);
  writeFileSync(sqlFile, input);
  await parseCommand({ _: ['parse', sqlFile], output: astFile, format });
  return astFile;
};

const positionKeys = /^(location|stmt_location|stmt_len|list_start|list_end|rexpr_list_start|rexpr_list_end)$/;
const withoutLocations = (ast: unknown) =>
  JSON.parse(JSON.stringify(ast, (key, value) => (positionKeys.test(key) ? undefined : value)));

describe('pgsql parse', () => {
  it('writes the AST as indented JSON by default and compact JSON with --format json', async () => {
    const pretty = readFileSync(await parseToFile(sql), 'utf-8');
    const compact = readFileSync(await parseToFile(sql, 'json'), 'utf-8');

    expect(pretty).toContain('\n');
    expect(compact).not.toContain('\n  ');
    expect(JSON.parse(pretty)).toEqual(JSON.parse(compact));
    expect(JSON.parse(pretty).stmts).toHaveLength(1);
  });
});

describe('pgsql deparse', () => {
  it('turns a parsed AST back into SQL that parses to the same AST', async () => {
    const astFile = await parseToFile(sql);
    const outFile = join(dir, 'out.sql');
    await deparseCommand({ _: ['deparse'], input: astFile, output: outFile });

    const roundTripped = readFileSync(outFile, 'utf-8');
    const reparsedFile = await parseToFile(roundTripped, 'json');

    expect(withoutLocations(JSON.parse(readFileSync(reparsedFile, 'utf-8'))))
      .toEqual(withoutLocations(JSON.parse(readFileSync(astFile, 'utf-8'))));
  });
});
