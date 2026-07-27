
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-update', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/update-1.sql",
  "original/upstream/update-2.sql",
  "original/upstream/update-3.sql",
  "original/upstream/update-4.sql",
  "original/upstream/update-5.sql",
  "original/upstream/update-6.sql",
  "original/upstream/update-7.sql",
  "original/upstream/update-8.sql",
  "original/upstream/update-9.sql",
  "original/upstream/update-10.sql",
  "original/upstream/update-11.sql",
  "original/upstream/update-12.sql",
  "original/upstream/update-13.sql",
  "original/upstream/update-14.sql",
  "original/upstream/update-15.sql",
  "original/upstream/update-16.sql",
  "original/upstream/update-17.sql",
  "original/upstream/update-18.sql",
  "original/upstream/update-19.sql",
  "original/upstream/update-20.sql",
  "original/upstream/update-21.sql",
  "original/upstream/update-22.sql",
  "original/upstream/update-23.sql",
  "original/upstream/update-24.sql",
  "original/upstream/update-25.sql",
  "original/upstream/update-26.sql",
  "original/upstream/update-27.sql",
  "original/upstream/update-28.sql",
  "original/upstream/update-29.sql",
  "original/upstream/update-30.sql",
  "original/upstream/update-31.sql",
  "original/upstream/update-32.sql",
  "original/upstream/update-33.sql",
  "original/upstream/update-34.sql",
  "original/upstream/update-35.sql",
  "original/upstream/update-36.sql"
]);
});
