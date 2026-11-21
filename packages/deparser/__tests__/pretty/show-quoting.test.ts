import { PrettyTest } from '../../test-utils/PrettyTest';

const prettyTest = new PrettyTest([
  'misc/show-quoting-1.sql',
  'misc/show-quoting-2.sql',
  'misc/show-quoting-3.sql',
  'misc/show-quoting-4.sql',
  'misc/show-quoting-5.sql',
  'misc/show-quoting-6.sql',
  'misc/show-quoting-7.sql',
  'misc/show-quoting-8.sql',
  'misc/show-quoting-9.sql',
  'misc/show-quoting-10.sql',
  'misc/show-quoting-11.sql',
  'misc/show-quoting-12.sql',
  'misc/show-quoting-13.sql'
]);
prettyTest.generateTests();
