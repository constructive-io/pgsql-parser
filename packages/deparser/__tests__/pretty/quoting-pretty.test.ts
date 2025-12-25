import { PrettyTest } from '../../test-utils/PrettyTest';
const prettyTest = new PrettyTest([
  'pretty/quoting-1.sql',
  'pretty/quoting-2.sql',
  'pretty/quoting-3.sql',
  'pretty/quoting-4.sql',
  'pretty/quoting-5.sql',
  'pretty/quoting-6.sql',
  'pretty/quoting-7.sql',
  'pretty/quoting-8.sql',
  'pretty/quoting-9.sql',
  'pretty/quoting-10.sql',
  'pretty/quoting-11.sql',
  'pretty/quoting-12.sql',
  'pretty/quoting-13.sql',
  'pretty/quoting-14.sql',
  'pretty/quoting-15.sql',
  'pretty/quoting-16.sql',
]);

prettyTest.generateTests();
