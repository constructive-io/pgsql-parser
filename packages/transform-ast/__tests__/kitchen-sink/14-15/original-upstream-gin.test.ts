
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-upstream-gin', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/gin-1.sql",
  "original/upstream/gin-2.sql",
  "original/upstream/gin-3.sql",
  "original/upstream/gin-4.sql",
  "original/upstream/gin-5.sql",
  "original/upstream/gin-6.sql",
  "original/upstream/gin-7.sql",
  "original/upstream/gin-8.sql",
  "original/upstream/gin-9.sql",
  "original/upstream/gin-10.sql",
  "original/upstream/gin-11.sql",
  "original/upstream/gin-12.sql",
  "original/upstream/gin-13.sql",
  "original/upstream/gin-14.sql",
  "original/upstream/gin-15.sql"
]);
});
