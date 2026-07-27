
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-comment', async () => {
  await fixtures.runFixtureTests([
  "original/comment-1.sql",
  "original/comment-2.sql",
  "original/comment-3.sql",
  "original/comment-4.sql",
  "original/comment-5.sql",
  "original/comment-6.sql",
  "original/comment-7.sql",
  "original/comment-8.sql",
  "original/comment-9.sql",
  "original/comment-10.sql"
]);
});
