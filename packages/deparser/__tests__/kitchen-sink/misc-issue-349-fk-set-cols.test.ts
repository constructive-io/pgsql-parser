
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-issue-349-fk-set-cols', async () => {
  await fixtures.runFixtureTests([
  "misc/issue-349-fk-set-cols-1.sql",
  "misc/issue-349-fk-set-cols-2.sql",
  "misc/issue-349-fk-set-cols-3.sql",
  "misc/issue-349-fk-set-cols-4.sql"
]);
});
