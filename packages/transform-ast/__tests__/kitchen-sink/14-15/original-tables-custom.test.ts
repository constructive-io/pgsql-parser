
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-tables-custom', async () => {
  await fixtures.runFixtureTests([
  "original/tables/custom-1.sql",
  "original/tables/custom-2.sql",
  "original/tables/custom-3.sql",
  "original/tables/custom-4.sql",
  "original/tables/custom-5.sql",
  "original/tables/custom-6.sql",
  "original/tables/custom-7.sql"
]);
});
