import { PrettyTest } from '../../test-utils/PrettyTest';

const prettyTest = new PrettyTest([
  'misc/fetch-all-1.sql',
  'misc/fetch-all-2.sql',
  'misc/fetch-all-3.sql',
  'misc/fetch-all-4.sql',
  'misc/fetch-all-5.sql',
  'misc/fetch-all-6.sql'
]);
prettyTest.generateTests();
