
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-prepare', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/prepare-1.sql",
  "original/upstream/prepare-2.sql",
  "original/upstream/prepare-3.sql",
  "original/upstream/prepare-4.sql",
  "original/upstream/prepare-5.sql",
  "original/upstream/prepare-6.sql",
  "original/upstream/prepare-7.sql",
  "original/upstream/prepare-8.sql",
  "original/upstream/prepare-9.sql",
  "original/upstream/prepare-10.sql",
  "original/upstream/prepare-11.sql",
  "original/upstream/prepare-12.sql",
  "original/upstream/prepare-13.sql",
  "original/upstream/prepare-14.sql",
  "original/upstream/prepare-15.sql",
  "original/upstream/prepare-16.sql",
  "original/upstream/prepare-17.sql",
  "original/upstream/prepare-18.sql",
  "original/upstream/prepare-19.sql",
  "original/upstream/prepare-20.sql",
  "original/upstream/prepare-21.sql",
  "original/upstream/prepare-22.sql",
  "original/upstream/prepare-23.sql",
  "original/upstream/prepare-24.sql",
  "original/upstream/prepare-25.sql",
  "original/upstream/prepare-26.sql",
  "original/upstream/prepare-27.sql",
  "original/upstream/prepare-28.sql",
  "original/upstream/prepare-29.sql",
  "original/upstream/prepare-30.sql"
]);
});
