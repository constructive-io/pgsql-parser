
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-transactions-lock', async () => {
  await fixtures.runFixtureTests([
  "original/transactions/lock-1.sql",
  "original/transactions/lock-2.sql",
  "original/transactions/lock-3.sql",
  "original/transactions/lock-4.sql",
  "original/transactions/lock-5.sql",
  "original/transactions/lock-6.sql",
  "original/transactions/lock-7.sql",
  "original/transactions/lock-8.sql",
  "original/transactions/lock-9.sql",
  "original/transactions/lock-10.sql",
  "original/transactions/lock-11.sql",
  "original/transactions/lock-12.sql",
  "original/transactions/lock-13.sql",
  "original/transactions/lock-14.sql",
  "original/transactions/lock-15.sql",
  "original/transactions/lock-16.sql",
  "original/transactions/lock-17.sql"
]);
});
