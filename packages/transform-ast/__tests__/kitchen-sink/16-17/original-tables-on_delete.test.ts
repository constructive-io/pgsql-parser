
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-tables-on_delete', async () => {
  await fixtures.runFixtureTests([
  "original/tables/on_delete-1.sql"
]);
});
