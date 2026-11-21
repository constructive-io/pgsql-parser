import { loadModule, parsePlPgSQLSync } from 'libpg-query';

import { deparseSync, PLpgSQLParseResult } from '../src';
import { PLpgSQLTestUtils } from '../test-utils';

const fixtures = require('../../../__fixtures__/plpgsql-generated/generated.json');

beforeAll(async () => {
  await loadModule();
});

it('preserves internal char and char array declarations', async () => {
  const sql = fixtures['plpgsql_deparser_fixes-71.sql'];
  await new PLpgSQLTestUtils().expectAstMatch('quoted char', sql);
  const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
  const output = deparseSync(parsed);
  expect(output).toContain('c "char"');
  expect(output).toContain('chars "char"[]');
  expect(output).not.toContain('ordinary "char"');
  expect(output).toMatchSnapshot();
});

it('preserves required quoting in simple type declarations', async () => {
  const sql = fixtures['plpgsql_deparser_fixes-72.sql'];
  await new PLpgSQLTestUtils().expectAstMatch('quoted simple types', sql);
  const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
  const output = deparseSync(parsed);
  expect(output).toContain('keyword_type "end"');
  expect(output).toContain('spaced_type "has space"');
  expect(output).toContain('mixed_type "MixedCase"');
  expect(output).toContain('escaped_type "has""quote"');
  expect(output).toContain('dotted_type "has.dot"');
  expect(output).toContain('array_type "MixedCase"[][]');
  expect(output).toContain('ordinary_type simple');
  expect(output).toMatchSnapshot();
});
