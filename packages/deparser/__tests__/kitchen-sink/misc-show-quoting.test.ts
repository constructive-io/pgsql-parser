
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-show-quoting', async () => {
  await fixtures.runFixtureTests([
  "misc/show-quoting-1.sql",
  "misc/show-quoting-2.sql",
  "misc/show-quoting-3.sql",
  "misc/show-quoting-4.sql",
  "misc/show-quoting-5.sql",
  "misc/show-quoting-6.sql",
  "misc/show-quoting-7.sql",
  "misc/show-quoting-8.sql",
  "misc/show-quoting-9.sql",
  "misc/show-quoting-10.sql"
]);
});
