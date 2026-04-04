
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-extract', async () => {
  await fixtures.runFixtureTests([
  "misc/extract-1.sql",
  "misc/extract-2.sql",
  "misc/extract-3.sql",
  "misc/extract-4.sql",
  "misc/extract-5.sql",
  "misc/extract-6.sql",
  "misc/extract-7.sql",
  "misc/extract-8.sql",
  "misc/extract-9.sql",
  "misc/extract-10.sql",
  "misc/extract-11.sql",
  "misc/extract-12.sql",
  "misc/extract-13.sql",
  "misc/extract-14.sql",
  "misc/extract-15.sql",
  "misc/extract-16.sql",
  "misc/extract-17.sql",
  "misc/extract-18.sql"
]);
});
