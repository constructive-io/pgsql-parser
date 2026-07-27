
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-transactions-begin_commit', async () => {
  await fixtures.runFixtureTests([
  "original/transactions/begin_commit-1.sql",
  "original/transactions/begin_commit-2.sql",
  "original/transactions/begin_commit-3.sql"
]);
});
