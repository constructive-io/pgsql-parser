
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-json-table', async () => {
  await fixtures.runFixtureTests([
  "misc/json-table-1.sql",
  "misc/json-table-2.sql",
  "misc/json-table-3.sql",
  "misc/json-table-4.sql",
  "misc/json-table-5.sql",
  "misc/json-table-6.sql",
  "misc/json-table-7.sql",
  "misc/json-table-8.sql",
  "misc/json-table-9.sql",
  "misc/json-table-10.sql",
  "misc/json-table-11.sql"
]);
});
