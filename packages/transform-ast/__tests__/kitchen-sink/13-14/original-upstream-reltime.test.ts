
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-reltime', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/reltime-1.sql",
  "original/upstream/reltime-2.sql",
  "original/upstream/reltime-3.sql",
  "original/upstream/reltime-4.sql",
  "original/upstream/reltime-5.sql",
  "original/upstream/reltime-6.sql",
  "original/upstream/reltime-7.sql",
  "original/upstream/reltime-8.sql",
  "original/upstream/reltime-9.sql",
  "original/upstream/reltime-10.sql",
  "original/upstream/reltime-11.sql",
  "original/upstream/reltime-12.sql",
  "original/upstream/reltime-13.sql",
  "original/upstream/reltime-14.sql",
  "original/upstream/reltime-15.sql",
  "original/upstream/reltime-16.sql",
  "original/upstream/reltime-17.sql"
]);
});
