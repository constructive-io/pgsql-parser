
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-pg_catalog', async () => {
  await fixtures.runFixtureTests([
  "original/pg_catalog-1.sql",
  "original/pg_catalog-2.sql",
  "original/pg_catalog-3.sql",
  "original/pg_catalog-4.sql"
]);
});
