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
  expect(output).toMatchSnapshot();
});
