
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-dbsize', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/dbsize-1.sql",
  "original/upstream/dbsize-2.sql",
  "original/upstream/dbsize-3.sql",
  "original/upstream/dbsize-4.sql",
  "original/upstream/dbsize-5.sql",
  "original/upstream/dbsize-6.sql",
  "original/upstream/dbsize-7.sql",
  "original/upstream/dbsize-8.sql",
  "original/upstream/dbsize-9.sql",
  "original/upstream/dbsize-10.sql",
  "original/upstream/dbsize-11.sql",
  "original/upstream/dbsize-12.sql",
  "original/upstream/dbsize-13.sql",
  "original/upstream/dbsize-14.sql",
  "original/upstream/dbsize-15.sql",
  "original/upstream/dbsize-16.sql",
  "original/upstream/dbsize-17.sql",
  "original/upstream/dbsize-18.sql",
  "original/upstream/dbsize-19.sql",
  "original/upstream/dbsize-20.sql",
  "original/upstream/dbsize-21.sql",
  "original/upstream/dbsize-22.sql"
]);
});
