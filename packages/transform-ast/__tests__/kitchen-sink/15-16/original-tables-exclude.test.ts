
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-tables-exclude', async () => {
  await fixtures.runFixtureTests([
  "original/tables/exclude-1.sql",
  "original/tables/exclude-2.sql"
]);
});
