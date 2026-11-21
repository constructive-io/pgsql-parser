
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-fetch-all', async () => {
  await fixtures.runFixtureTests([
  "misc/fetch-all-1.sql",
  "misc/fetch-all-2.sql",
  "misc/fetch-all-3.sql",
  "misc/fetch-all-4.sql",
  "misc/fetch-all-5.sql",
  "misc/fetch-all-6.sql"
]);
});
