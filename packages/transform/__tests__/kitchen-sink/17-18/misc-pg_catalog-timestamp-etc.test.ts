
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(17, 18);

it('misc-pg_catalog-timestamp-etc', async () => {
  await fixtures.runFixtureTests([
  "misc/pg_catalog-timestamp-etc-1.sql",
  "misc/pg_catalog-timestamp-etc-2.sql",
  "misc/pg_catalog-timestamp-etc-3.sql",
  "misc/pg_catalog-timestamp-etc-4.sql",
  "misc/pg_catalog-timestamp-etc-5.sql",
  "misc/pg_catalog-timestamp-etc-6.sql",
  "misc/pg_catalog-timestamp-etc-7.sql",
  "misc/pg_catalog-timestamp-etc-8.sql",
  "misc/pg_catalog-timestamp-etc-9.sql",
  "misc/pg_catalog-timestamp-etc-10.sql",
  "misc/pg_catalog-timestamp-etc-11.sql",
  "misc/pg_catalog-timestamp-etc-12.sql",
  "misc/pg_catalog-timestamp-etc-13.sql"
]);
});
