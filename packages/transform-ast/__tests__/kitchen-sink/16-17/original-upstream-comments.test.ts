
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-upstream-comments', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/comments-1.sql",
  "original/upstream/comments-2.sql",
  "original/upstream/comments-3.sql",
  "original/upstream/comments-4.sql",
  "original/upstream/comments-5.sql",
  "original/upstream/comments-6.sql"
]);
});
