
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(17, 18);

it('misc-merge-seclabel', async () => {
  await fixtures.runFixtureTests([
  "misc/merge-seclabel-1.sql",
  "misc/merge-seclabel-2.sql",
  "misc/merge-seclabel-3.sql",
  "misc/merge-seclabel-4.sql",
  "misc/merge-seclabel-5.sql",
  "misc/merge-seclabel-6.sql",
  "misc/merge-seclabel-7.sql",
  "misc/merge-seclabel-8.sql"
]);
});
