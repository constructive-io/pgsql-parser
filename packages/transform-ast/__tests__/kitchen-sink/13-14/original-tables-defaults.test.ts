
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-tables-defaults', async () => {
  await fixtures.runFixtureTests([
  "original/tables/defaults-1.sql"
]);
});
