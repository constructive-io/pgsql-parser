import { PrettyTest } from '../../test-utils/PrettyTest';
const prettyTest = new PrettyTest([
  'pretty/formatting-1.sql',
  'pretty/formatting-2.sql',
  'pretty/formatting-3.sql',
  'pretty/formatting-4.sql',
  'pretty/formatting-5.sql',
  'pretty/formatting-6.sql',
  'pretty/formatting-7.sql',
  'pretty/formatting-8.sql',
  'pretty/formatting-9.sql',
]);

prettyTest.generateTests();
