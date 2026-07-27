
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('pretty-tables', async () => {
  await fixtures.runFixtureTests([
  "pretty/tables-1.sql",
  "pretty/tables-2.sql",
  "pretty/tables-3.sql",
  "pretty/tables-4.sql",
  "pretty/tables-5.sql",
  "pretty/tables-6.sql",
  "pretty/tables-7.sql",
  "pretty/tables-8.sql",
  "pretty/tables-9.sql",
  "pretty/tables-10.sql",
  "pretty/tables-11.sql",
  "pretty/tables-12.sql",
  "pretty/tables-13.sql",
  "pretty/tables-14.sql",
  "pretty/tables-15.sql",
  "pretty/tables-16.sql",
  "pretty/tables-17.sql",
  "pretty/tables-18.sql",
  "pretty/tables-19.sql",
  "pretty/tables-20.sql"
]);
});
