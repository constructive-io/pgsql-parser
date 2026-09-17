
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-issue-348-350-partition-cmd', async () => {
  await fixtures.runFixtureTests([
  "misc/issue-348-350-partition-cmd-1.sql",
  "misc/issue-348-350-partition-cmd-2.sql",
  "misc/issue-348-350-partition-cmd-3.sql",
  "misc/issue-348-350-partition-cmd-4.sql",
  "misc/issue-348-350-partition-cmd-5.sql",
  "misc/issue-348-350-partition-cmd-6.sql",
  "misc/issue-348-350-partition-cmd-7.sql",
  "misc/issue-348-350-partition-cmd-8.sql",
  "misc/issue-348-350-partition-cmd-9.sql"
]);
});
