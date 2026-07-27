
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-upstream-time', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/time-1.sql",
  "original/upstream/time-2.sql",
  "original/upstream/time-3.sql",
  "original/upstream/time-4.sql",
  "original/upstream/time-5.sql",
  "original/upstream/time-6.sql",
  "original/upstream/time-7.sql",
  "original/upstream/time-8.sql",
  "original/upstream/time-9.sql",
  "original/upstream/time-10.sql",
  "original/upstream/time-11.sql",
  "original/upstream/time-12.sql",
  "original/upstream/time-13.sql",
  "original/upstream/time-14.sql",
  "original/upstream/time-15.sql",
  "original/upstream/time-16.sql",
  "original/upstream/time-17.sql",
  "original/upstream/time-18.sql"
]);
});
