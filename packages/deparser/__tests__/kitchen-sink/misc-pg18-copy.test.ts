
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-pg18-copy', async () => {
  await fixtures.runFixtureTests([
  "misc/pg18-copy-1.sql",
  "misc/pg18-copy-2.sql",
  "misc/pg18-copy-3.sql",
  "misc/pg18-copy-4.sql",
  "misc/pg18-copy-5.sql",
  "misc/pg18-copy-6.sql",
  "misc/pg18-copy-7.sql",
  "misc/pg18-copy-8.sql",
  "misc/pg18-copy-9.sql",
  "misc/pg18-copy-10.sql",
  "misc/pg18-copy-11.sql",
  "misc/pg18-copy-12.sql",
  "misc/pg18-copy-13.sql",
  "misc/pg18-copy-14.sql",
  "misc/pg18-copy-15.sql",
  "misc/pg18-copy-16.sql",
  "misc/pg18-copy-17.sql",
  "misc/pg18-copy-18.sql",
  "misc/pg18-copy-19.sql",
  "misc/pg18-copy-20.sql"
]);
});
