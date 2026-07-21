
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('misc-pg18', async () => {
  await fixtures.runFixtureTests([
  "misc/pg18-1.sql",
  "misc/pg18-2.sql",
  "misc/pg18-3.sql",
  "misc/pg18-4.sql",
  "misc/pg18-5.sql",
  "misc/pg18-6.sql",
  "misc/pg18-7.sql",
  "misc/pg18-8.sql",
  "misc/pg18-9.sql",
  "misc/pg18-10.sql",
  "misc/pg18-11.sql",
  "misc/pg18-12.sql",
  "misc/pg18-13.sql",
  "misc/pg18-14.sql",
  "misc/pg18-15.sql",
  "misc/pg18-16.sql",
  "misc/pg18-17.sql",
  "misc/pg18-18.sql",
  "misc/pg18-19.sql",
  "misc/pg18-20.sql",
  "misc/pg18-21.sql",
  "misc/pg18-22.sql",
  "misc/pg18-23.sql",
  "misc/pg18-24.sql",
  "misc/pg18-25.sql"
]);
});
