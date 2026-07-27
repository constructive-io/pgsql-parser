
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('misc-pg_catalog', async () => {
  await fixtures.runFixtureTests([
  "misc/pg_catalog-1.sql",
  "misc/pg_catalog-2.sql",
  "misc/pg_catalog-3.sql",
  "misc/pg_catalog-4.sql",
  "misc/pg_catalog-5.sql",
  "misc/pg_catalog-6.sql",
  "misc/pg_catalog-7.sql",
  "misc/pg_catalog-8.sql",
  "misc/pg_catalog-9.sql",
  "misc/pg_catalog-10.sql",
  "misc/pg_catalog-11.sql",
  "misc/pg_catalog-12.sql",
  "misc/pg_catalog-13.sql",
  "misc/pg_catalog-14.sql",
  "misc/pg_catalog-15.sql",
  "misc/pg_catalog-16.sql",
  "misc/pg_catalog-17.sql"
]);
});
