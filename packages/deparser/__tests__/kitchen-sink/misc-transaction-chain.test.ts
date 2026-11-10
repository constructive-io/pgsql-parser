
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-transaction-chain', async () => {
  await fixtures.runFixtureTests([
  "misc/transaction-chain-1.sql",
  "misc/transaction-chain-2.sql",
  "misc/transaction-chain-3.sql",
  "misc/transaction-chain-4.sql",
  "misc/transaction-chain-5.sql",
  "misc/transaction-chain-6.sql",
  "misc/transaction-chain-7.sql"
]);
});
