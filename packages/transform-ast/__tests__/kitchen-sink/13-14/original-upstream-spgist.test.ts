
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-spgist', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/spgist-1.sql",
  "original/upstream/spgist-2.sql",
  "original/upstream/spgist-3.sql",
  "original/upstream/spgist-4.sql",
  "original/upstream/spgist-5.sql",
  "original/upstream/spgist-6.sql",
  "original/upstream/spgist-7.sql",
  "original/upstream/spgist-8.sql",
  "original/upstream/spgist-9.sql",
  "original/upstream/spgist-10.sql",
  "original/upstream/spgist-11.sql",
  "original/upstream/spgist-12.sql",
  "original/upstream/spgist-13.sql",
  "original/upstream/spgist-14.sql"
]);
});
