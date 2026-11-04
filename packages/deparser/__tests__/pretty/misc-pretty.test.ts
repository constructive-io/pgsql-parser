import { PrettyTest } from '../../test-utils/PrettyTest';

const testCases = [
  'pretty/misc-1.sql',
  'pretty/misc-2.sql',
  'pretty/misc-3.sql',
  'pretty/misc-4.sql',
  'pretty/misc-5.sql',
  'pretty/misc-6.sql',
  'pretty/misc-7.sql',
  'pretty/misc-8.sql',
  'pretty/misc-9.sql',
  'pretty/misc-10.sql',
  'pretty/misc-11.sql',
  'pretty/misc-12.sql',
  'pretty/misc-13.sql',
  'pretty/misc-14.sql',
  'pretty/misc-15.sql',
  'pretty/misc-16.sql',
  'pretty/misc-17.sql',
  'pretty/misc-18.sql',
  'pretty/misc-19.sql',
];

const prettyTest = new PrettyTest(testCases);
prettyTest.generateTests();
