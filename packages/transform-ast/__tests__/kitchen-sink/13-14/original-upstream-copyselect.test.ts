
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-copyselect', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/copyselect-1.sql",
  "original/upstream/copyselect-2.sql",
  "original/upstream/copyselect-3.sql",
  "original/upstream/copyselect-4.sql",
  "original/upstream/copyselect-5.sql",
  "original/upstream/copyselect-6.sql",
  "original/upstream/copyselect-7.sql",
  "original/upstream/copyselect-8.sql",
  "original/upstream/copyselect-9.sql",
  "original/upstream/copyselect-10.sql",
  "original/upstream/copyselect-11.sql",
  "original/upstream/copyselect-12.sql",
  "original/upstream/copyselect-13.sql",
  "original/upstream/copyselect-14.sql",
  "original/upstream/copyselect-15.sql",
  "original/upstream/copyselect-16.sql",
  "original/upstream/copyselect-17.sql",
  "original/upstream/copyselect-18.sql"
]);
});
