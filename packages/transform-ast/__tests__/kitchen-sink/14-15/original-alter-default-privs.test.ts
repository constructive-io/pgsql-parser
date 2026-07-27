
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-alter-default-privs', async () => {
  await fixtures.runFixtureTests([
  "original/alter/default-privs-1.sql",
  "original/alter/default-privs-2.sql",
  "original/alter/default-privs-3.sql",
  "original/alter/default-privs-4.sql",
  "original/alter/default-privs-5.sql",
  "original/alter/default-privs-6.sql",
  "original/alter/default-privs-7.sql"
]);
});
