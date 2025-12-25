import { PrettyTest } from '../../test-utils/PrettyTest';
const prettyTest = new PrettyTest([
  'pretty/quoting-1.sql',
  'pretty/quoting-2.sql',
  'pretty/quoting-3.sql',
  'pretty/quoting-4.sql',
  'pretty/quoting-5.sql',
  'pretty/quoting-6.sql',
  'pretty/quoting-7.sql',
]);

prettyTest.generateTests();
