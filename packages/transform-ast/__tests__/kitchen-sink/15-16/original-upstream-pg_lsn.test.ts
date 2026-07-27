
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-pg_lsn', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/pg_lsn-1.sql",
  "original/upstream/pg_lsn-2.sql",
  "original/upstream/pg_lsn-3.sql",
  "original/upstream/pg_lsn-4.sql",
  "original/upstream/pg_lsn-5.sql",
  "original/upstream/pg_lsn-6.sql",
  "original/upstream/pg_lsn-7.sql",
  "original/upstream/pg_lsn-8.sql",
  "original/upstream/pg_lsn-9.sql",
  "original/upstream/pg_lsn-10.sql",
  "original/upstream/pg_lsn-11.sql",
  "original/upstream/pg_lsn-12.sql",
  "original/upstream/pg_lsn-13.sql",
  "original/upstream/pg_lsn-14.sql",
  "original/upstream/pg_lsn-15.sql",
  "original/upstream/pg_lsn-16.sql",
  "original/upstream/pg_lsn-17.sql"
]);
});
