
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-issues', async () => {
  await fixtures.runFixtureTests([
  "misc/issues-1.sql",
  "misc/issues-2.sql",
  "misc/issues-3.sql",
  "misc/issues-4.sql",
  "misc/issues-5.sql",
  "misc/issues-6.sql",
  "misc/issues-7.sql",
  "misc/issues-8.sql",
  "misc/issues-9.sql",
  "misc/issues-10.sql",
  "misc/issues-11.sql",
  "misc/issues-12.sql",
  "misc/issues-13.sql",
  "misc/issues-14.sql",
  "misc/issues-15.sql",
  "misc/issues-16.sql",
  "misc/issues-17.sql",
  "misc/issues-18.sql",
  "misc/issues-19.sql",
  "misc/issues-20.sql"
]);
});
