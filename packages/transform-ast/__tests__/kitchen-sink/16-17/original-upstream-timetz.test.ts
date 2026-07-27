
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-upstream-timetz', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/timetz-1.sql",
  "original/upstream/timetz-2.sql",
  "original/upstream/timetz-3.sql",
  "original/upstream/timetz-4.sql",
  "original/upstream/timetz-5.sql",
  "original/upstream/timetz-6.sql",
  "original/upstream/timetz-7.sql",
  "original/upstream/timetz-8.sql",
  "original/upstream/timetz-9.sql",
  "original/upstream/timetz-10.sql",
  "original/upstream/timetz-11.sql",
  "original/upstream/timetz-12.sql",
  "original/upstream/timetz-13.sql",
  "original/upstream/timetz-14.sql",
  "original/upstream/timetz-15.sql",
  "original/upstream/timetz-16.sql",
  "original/upstream/timetz-17.sql",
  "original/upstream/timetz-18.sql",
  "original/upstream/timetz-19.sql",
  "original/upstream/timetz-20.sql"
]);
});
