
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(17, 18);

it('original-tables-exclude', async () => {
  await fixtures.runFixtureTests([
  "original/tables/exclude-1.sql",
  "original/tables/exclude-2.sql"
]);
});
