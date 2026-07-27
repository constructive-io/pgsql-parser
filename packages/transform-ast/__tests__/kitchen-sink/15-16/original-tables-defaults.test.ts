
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-tables-defaults', async () => {
  await fixtures.runFixtureTests([
  "original/tables/defaults-1.sql"
]);
});
