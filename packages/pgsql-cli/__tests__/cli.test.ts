import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { loadModule, parseSync } from 'pgsql-parser';

import { deparseCommand } from '../src/commands/deparse';
import { parseCommand } from '../src/commands/parse';
import { protoFetchCommand } from '../src/commands/proto-fetch';
import { generateProtoJS, replaceTextInProtoJS } from '../src/commands/proto-fetch/helpers';

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

describe('pgsql proto-fetch', () => {
  it('resolves standard protobuf imports from the installed runtime', async () => {
    const inFile = join(dir, 'descriptor-user.proto');
    const outFile = join(dir, 'descriptor-user.js');
    writeFileSync(inFile, `
      syntax = "proto2";
      import "google/protobuf/descriptor.proto";
      message Example {
        optional google.protobuf.FileDescriptorProto descriptor = 1;
      }
    `);

    await generateProtoJS(inFile, outFile);

    expect(readFileSync(outFile, 'utf-8')).toContain('$root.google.protobuf.FileDescriptorProto');
  });

  it('round-trips a qualified extension name', async () => {
    const inFile = join(dir, 'example.proto');
    const outFile = join(dir, 'example.js');
    writeFileSync(inFile, `
      syntax = "proto2";
      package demo;
      message Example { extensions 100 to max; }
      extend Example { optional string extra = 100; }
    `);

    await generateProtoJS(inFile, outFile);
    await replaceTextInProtoJS(outFile, 'protobufjs/minimal', require.resolve('protobufjs/minimal'));

    const { Example } = require(outFile).demo;
    const value = { '.demo.extra': 'extension' };
    expect(Example.toObject(Example.decode(Example.encode(value).finish()))).toEqual(value);
  });

  it.each(['first-name', 'first    name', '2fa', 'class', '__proto__', 'constructor', 'toJSON'])('rejects an unsupported alias (%s)', async name => {
    const inFile = join(dir, 'example.proto');
    const outFile = join(dir, 'example.js');
    writeFileSync(inFile, `
      syntax = "proto3";
      message Example { string label = 1 [json_name = "${name}"]; }
    `);

    await expect(generateProtoJS(inFile, outFile)).rejects.toThrow(
      `Invalid JSON field name ${JSON.stringify(name)} on .Example.label`
    );
  });

  it.each([
    [undefined, 'protobufjs/minimal'],
    ['@custom/protobufjs', '@custom/protobufjs'],
  ])('generates a module with the requested runtime (%s)', async (withPkg, runtime) => {
    const inFile = join(dir, 'test input.proto');
    const outFile = join(dir, 'test output.js');
    writeFileSync(inFile, 'syntax = "proto3"; message Example { string text = 1; }');

    await protoFetchCommand({ inFile, outFile, 'with-pkg': withPkg });

    expect(readFileSync(outFile, 'utf-8')).toContain(`require("${runtime}")`);
  });

  it('round-trips a PostgreSQL AST using its JSON field names', async () => {
    const inFile = resolve(__dirname, '../../../__fixtures__/proto/18-latest.proto');
    const outFile = join(dir, 'pg-query.js');
    await protoFetchCommand({ inFile, outFile, 'with-pkg': require.resolve('protobufjs/minimal') });

    const { ParseResult } = require(outFile).pg_query;
    await loadModule();
    const ast = parseSync('SELECT 42');
    const message = ParseResult.fromObject(ast);
    const decoded = ParseResult.decode(ParseResult.encode(message).finish());

    expect(ParseResult.toObject(decoded, { enums: String, longs: Number })).toEqual(ast);
  }, 20_000);
});
