import { PrettyTest } from '../../test-utils/PrettyTest';

const prettyTest = new PrettyTest([
  'misc/qualified-rangevar-1.sql',
  'misc/qualified-rangevar-2.sql',
  'misc/qualified-rangevar-3.sql',
  'misc/qualified-rangevar-4.sql',
  'misc/qualified-rangevar-5.sql',
  'misc/qualified-rangevar-6.sql',
  'misc/qualified-rangevar-7.sql',
  'misc/qualified-rangevar-8.sql'
]);
prettyTest.generateTests();
