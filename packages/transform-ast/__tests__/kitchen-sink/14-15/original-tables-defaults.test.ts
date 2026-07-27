
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-tables-defaults', async () => {
  await fixtures.runFixtureTests([
  "original/tables/defaults-1.sql"
]);
});
