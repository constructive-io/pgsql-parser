
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-brin', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/brin-1.sql",
  "original/upstream/brin-2.sql",
  "original/upstream/brin-3.sql",
  "original/upstream/brin-4.sql",
  "original/upstream/brin-5.sql",
  "original/upstream/brin-6.sql",
  "original/upstream/brin-7.sql",
  "original/upstream/brin-8.sql",
  "original/upstream/brin-9.sql",
  "original/upstream/brin-10.sql",
  "original/upstream/brin-11.sql",
  "original/upstream/brin-12.sql",
  "original/upstream/brin-13.sql",
  "original/upstream/brin-14.sql"
]);
});
