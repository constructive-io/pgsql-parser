
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-privs-and-defaults', async () => {
  await fixtures.runFixtureTests([
  "original/privs-and-defaults-1.sql",
  "original/privs-and-defaults-2.sql",
  "original/privs-and-defaults-3.sql",
  "original/privs-and-defaults-4.sql",
  "original/privs-and-defaults-5.sql",
  "original/privs-and-defaults-6.sql",
  "original/privs-and-defaults-7.sql",
  "original/privs-and-defaults-8.sql"
]);
});
