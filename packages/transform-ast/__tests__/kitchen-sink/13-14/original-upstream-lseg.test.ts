
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-lseg', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/lseg-1.sql",
  "original/upstream/lseg-2.sql",
  "original/upstream/lseg-3.sql",
  "original/upstream/lseg-4.sql",
  "original/upstream/lseg-5.sql",
  "original/upstream/lseg-6.sql",
  "original/upstream/lseg-7.sql",
  "original/upstream/lseg-8.sql",
  "original/upstream/lseg-9.sql",
  "original/upstream/lseg-10.sql",
  "original/upstream/lseg-11.sql",
  "original/upstream/lseg-12.sql",
  "original/upstream/lseg-13.sql"
]);
});
