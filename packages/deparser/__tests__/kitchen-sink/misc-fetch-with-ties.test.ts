
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-fetch-with-ties', async () => {
  await fixtures.runFixtureTests([
  "misc/fetch-with-ties-1.sql",
  "misc/fetch-with-ties-2.sql",
  "misc/fetch-with-ties-3.sql",
  "misc/fetch-with-ties-4.sql",
  "misc/fetch-with-ties-5.sql",
  "misc/fetch-with-ties-6.sql",
  "misc/fetch-with-ties-7.sql",
  "misc/fetch-with-ties-8.sql"
]);
});
