
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-tables-nulls', async () => {
  await fixtures.runFixtureTests([
  "original/tables/nulls-1.sql",
  "original/tables/nulls-2.sql",
  "original/tables/nulls-3.sql"
]);
});
