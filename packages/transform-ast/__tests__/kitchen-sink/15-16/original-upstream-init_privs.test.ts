
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-init_privs', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/init_privs-1.sql",
  "original/upstream/init_privs-2.sql",
  "original/upstream/init_privs-3.sql",
  "original/upstream/init_privs-4.sql"
]);
});
