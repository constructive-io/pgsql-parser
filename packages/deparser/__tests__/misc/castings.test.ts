import { expectParseDeparse } from '../../test-utils';

it('should format foreign key constraint with pretty option enabled', async () => {
  const sql = `SELECT '123'::INTEGER;`;
  const result = await expectParseDeparse(sql, { pretty: true });
  expect(result).toMatchSnapshot();
});
