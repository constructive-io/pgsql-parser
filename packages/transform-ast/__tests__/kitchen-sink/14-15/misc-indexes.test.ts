
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('misc-indexes', async () => {
  await fixtures.runFixtureTests([
  "misc/indexes-1.sql",
  "misc/indexes-2.sql",
  "misc/indexes-3.sql",
  "misc/indexes-4.sql",
  "misc/indexes-5.sql",
  "misc/indexes-6.sql",
  "misc/indexes-7.sql",
  "misc/indexes-8.sql",
  "misc/indexes-9.sql",
  "misc/indexes-10.sql",
  "misc/indexes-11.sql",
  "misc/indexes-12.sql",
  "misc/indexes-13.sql"
]);
});
