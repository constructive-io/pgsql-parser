
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-issue-292-merge-when', async () => {
  await fixtures.runFixtureTests([
  "misc/issue-292-merge-when-1.sql",
  "misc/issue-292-merge-when-2.sql",
  "misc/issue-292-merge-when-3.sql",
  "misc/issue-292-merge-when-4.sql",
  "misc/issue-292-merge-when-5.sql"
]);
});
