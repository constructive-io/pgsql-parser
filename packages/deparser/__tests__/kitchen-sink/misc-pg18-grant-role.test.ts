
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-pg18-grant-role', async () => {
  await fixtures.runFixtureTests([
  "misc/pg18-grant-role-1.sql",
  "misc/pg18-grant-role-2.sql",
  "misc/pg18-grant-role-3.sql",
  "misc/pg18-grant-role-4.sql",
  "misc/pg18-grant-role-5.sql",
  "misc/pg18-grant-role-6.sql",
  "misc/pg18-grant-role-7.sql",
  "misc/pg18-grant-role-8.sql",
  "misc/pg18-grant-role-9.sql",
  "misc/pg18-grant-role-10.sql",
  "misc/pg18-grant-role-11.sql",
  "misc/pg18-grant-role-12.sql",
  "misc/pg18-grant-role-13.sql",
  "misc/pg18-grant-role-14.sql",
  "misc/pg18-grant-role-15.sql",
  "misc/pg18-grant-role-16.sql",
  "misc/pg18-grant-role-17.sql",
  "misc/pg18-grant-role-18.sql",
  "misc/pg18-grant-role-19.sql"
]);
});
