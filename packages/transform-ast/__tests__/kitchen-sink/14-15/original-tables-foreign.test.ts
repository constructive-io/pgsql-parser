
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-tables-foreign', async () => {
  await fixtures.runFixtureTests([
  "original/tables/foreign-1.sql",
  "original/tables/foreign-2.sql",
  "original/tables/foreign-3.sql",
  "original/tables/foreign-4.sql",
  "original/tables/foreign-5.sql",
  "original/tables/foreign-6.sql"
]);
});
