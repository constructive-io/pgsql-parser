
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-roles-grants', async () => {
  await fixtures.runFixtureTests([
  "original/roles/grants-1.sql",
  "original/roles/grants-2.sql",
  "original/roles/grants-3.sql"
]);
});
