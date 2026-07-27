
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-upstream-errors', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/errors-1.sql",
  "original/upstream/errors-2.sql",
  "original/upstream/errors-3.sql",
  "original/upstream/errors-4.sql",
  "original/upstream/errors-5.sql",
  "original/upstream/errors-6.sql",
  "original/upstream/errors-7.sql",
  "original/upstream/errors-8.sql",
  "original/upstream/errors-9.sql",
  "original/upstream/errors-10.sql",
  "original/upstream/errors-11.sql",
  "original/upstream/errors-12.sql",
  "original/upstream/errors-13.sql",
  "original/upstream/errors-14.sql",
  "original/upstream/errors-15.sql",
  "original/upstream/errors-16.sql",
  "original/upstream/errors-17.sql",
  "original/upstream/errors-18.sql",
  "original/upstream/errors-19.sql",
  "original/upstream/errors-20.sql",
  "original/upstream/errors-21.sql",
  "original/upstream/errors-22.sql",
  "original/upstream/errors-23.sql",
  "original/upstream/errors-24.sql",
  "original/upstream/errors-25.sql",
  "original/upstream/errors-26.sql",
  "original/upstream/errors-27.sql",
  "original/upstream/errors-28.sql",
  "original/upstream/errors-29.sql",
  "original/upstream/errors-30.sql",
  "original/upstream/errors-31.sql",
  "original/upstream/errors-32.sql"
]);
});
