
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-tinterval', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/tinterval-1.sql",
  "original/upstream/tinterval-2.sql",
  "original/upstream/tinterval-3.sql",
  "original/upstream/tinterval-4.sql",
  "original/upstream/tinterval-5.sql",
  "original/upstream/tinterval-6.sql",
  "original/upstream/tinterval-7.sql",
  "original/upstream/tinterval-8.sql",
  "original/upstream/tinterval-9.sql",
  "original/upstream/tinterval-10.sql",
  "original/upstream/tinterval-11.sql",
  "original/upstream/tinterval-12.sql",
  "original/upstream/tinterval-13.sql",
  "original/upstream/tinterval-14.sql",
  "original/upstream/tinterval-15.sql",
  "original/upstream/tinterval-16.sql",
  "original/upstream/tinterval-17.sql",
  "original/upstream/tinterval-18.sql",
  "original/upstream/tinterval-19.sql",
  "original/upstream/tinterval-20.sql"
]);
});
