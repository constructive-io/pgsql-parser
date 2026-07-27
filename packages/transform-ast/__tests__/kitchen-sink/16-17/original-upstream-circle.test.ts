
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-upstream-circle', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/circle-1.sql",
  "original/upstream/circle-2.sql",
  "original/upstream/circle-3.sql",
  "original/upstream/circle-4.sql",
  "original/upstream/circle-5.sql",
  "original/upstream/circle-6.sql",
  "original/upstream/circle-7.sql",
  "original/upstream/circle-8.sql",
  "original/upstream/circle-9.sql",
  "original/upstream/circle-10.sql",
  "original/upstream/circle-11.sql",
  "original/upstream/circle-12.sql",
  "original/upstream/circle-13.sql",
  "original/upstream/circle-14.sql",
  "original/upstream/circle-15.sql",
  "original/upstream/circle-16.sql",
  "original/upstream/circle-17.sql"
]);
});
