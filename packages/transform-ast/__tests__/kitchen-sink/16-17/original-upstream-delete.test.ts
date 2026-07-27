
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-upstream-delete', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/delete-1.sql",
  "original/upstream/delete-2.sql",
  "original/upstream/delete-3.sql",
  "original/upstream/delete-4.sql",
  "original/upstream/delete-5.sql",
  "original/upstream/delete-6.sql",
  "original/upstream/delete-7.sql",
  "original/upstream/delete-8.sql",
  "original/upstream/delete-9.sql",
  "original/upstream/delete-10.sql"
]);
});
