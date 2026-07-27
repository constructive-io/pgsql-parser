
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-upstream-oid', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/oid-1.sql",
  "original/upstream/oid-2.sql",
  "original/upstream/oid-3.sql",
  "original/upstream/oid-4.sql",
  "original/upstream/oid-5.sql",
  "original/upstream/oid-6.sql",
  "original/upstream/oid-7.sql",
  "original/upstream/oid-8.sql",
  "original/upstream/oid-9.sql",
  "original/upstream/oid-10.sql",
  "original/upstream/oid-11.sql",
  "original/upstream/oid-12.sql",
  "original/upstream/oid-13.sql",
  "original/upstream/oid-14.sql",
  "original/upstream/oid-15.sql",
  "original/upstream/oid-16.sql",
  "original/upstream/oid-17.sql",
  "original/upstream/oid-18.sql",
  "original/upstream/oid-19.sql",
  "original/upstream/oid-20.sql",
  "original/upstream/oid-21.sql",
  "original/upstream/oid-22.sql",
  "original/upstream/oid-23.sql",
  "original/upstream/oid-24.sql",
  "original/upstream/oid-25.sql",
  "original/upstream/oid-26.sql",
  "original/upstream/oid-27.sql"
]);
});
