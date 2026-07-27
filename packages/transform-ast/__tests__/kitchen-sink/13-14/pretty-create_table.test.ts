
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('pretty-create_table', async () => {
  await fixtures.runFixtureTests([
  "pretty/create_table-1.sql",
  "pretty/create_table-2.sql",
  "pretty/create_table-3.sql",
  "pretty/create_table-4.sql",
  "pretty/create_table-5.sql",
  "pretty/create_table-6.sql"
]);
});
