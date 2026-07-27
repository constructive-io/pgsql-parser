
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-upstream-abstime', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/abstime-1.sql",
  "original/upstream/abstime-2.sql",
  "original/upstream/abstime-3.sql",
  "original/upstream/abstime-4.sql",
  "original/upstream/abstime-5.sql",
  "original/upstream/abstime-6.sql",
  "original/upstream/abstime-7.sql",
  "original/upstream/abstime-8.sql",
  "original/upstream/abstime-9.sql",
  "original/upstream/abstime-10.sql",
  "original/upstream/abstime-11.sql",
  "original/upstream/abstime-12.sql",
  "original/upstream/abstime-13.sql",
  "original/upstream/abstime-14.sql",
  "original/upstream/abstime-15.sql",
  "original/upstream/abstime-16.sql",
  "original/upstream/abstime-17.sql",
  "original/upstream/abstime-18.sql",
  "original/upstream/abstime-19.sql",
  "original/upstream/abstime-20.sql",
  "original/upstream/abstime-21.sql",
  "original/upstream/abstime-22.sql",
  "original/upstream/abstime-23.sql",
  "original/upstream/abstime-24.sql"
]);
});
