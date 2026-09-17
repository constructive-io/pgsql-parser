
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-pg18-misc-ddl', async () => {
  await fixtures.runFixtureTests([
  "misc/pg18-misc-ddl-1.sql",
  "misc/pg18-misc-ddl-2.sql",
  "misc/pg18-misc-ddl-3.sql",
  "misc/pg18-misc-ddl-4.sql",
  "misc/pg18-misc-ddl-5.sql",
  "misc/pg18-misc-ddl-6.sql",
  "misc/pg18-misc-ddl-7.sql",
  "misc/pg18-misc-ddl-8.sql",
  "misc/pg18-misc-ddl-9.sql",
  "misc/pg18-misc-ddl-10.sql",
  "misc/pg18-misc-ddl-11.sql",
  "misc/pg18-misc-ddl-12.sql",
  "misc/pg18-misc-ddl-13.sql",
  "misc/pg18-misc-ddl-14.sql",
  "misc/pg18-misc-ddl-15.sql"
]);
});
