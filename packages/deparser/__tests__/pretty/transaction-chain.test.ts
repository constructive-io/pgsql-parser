import { PrettyTest } from '../../test-utils/PrettyTest';

const prettyTest = new PrettyTest([
  'misc/transaction-chain-1.sql',
  'misc/transaction-chain-2.sql',
  'misc/transaction-chain-3.sql',
  'misc/transaction-chain-4.sql',
  'misc/transaction-chain-5.sql',
  'misc/transaction-chain-6.sql',
  'misc/transaction-chain-7.sql',
  'misc/transaction-chain-8.sql'
]);
prettyTest.generateTests();
