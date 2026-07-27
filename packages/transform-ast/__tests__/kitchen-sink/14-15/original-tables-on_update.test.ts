
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-tables-on_update', async () => {
  await fixtures.runFixtureTests([
  "original/tables/on_update-1.sql"
]);
});
