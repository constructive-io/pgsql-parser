
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-alter-trigger-rename', async () => {
  await fixtures.runFixtureTests([
  "misc/alter-trigger-rename-1.sql",
  "misc/alter-trigger-rename-2.sql",
  "misc/alter-trigger-rename-3.sql"
]);
});
