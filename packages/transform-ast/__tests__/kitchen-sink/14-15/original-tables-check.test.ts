
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-tables-check', async () => {
  await fixtures.runFixtureTests([
  "original/tables/check-1.sql",
  "original/tables/check-2.sql",
  "original/tables/check-3.sql",
  "original/tables/check-4.sql",
  "original/tables/check-5.sql",
  "original/tables/check-6.sql",
  "original/tables/check-7.sql",
  "original/tables/check-8.sql",
  "original/tables/check-9.sql"
]);
});
