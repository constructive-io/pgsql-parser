import { PrettyTest } from '../../test-utils/PrettyTest';

const prettyTest = new PrettyTest([
  'misc/xml-indent-1.sql',
  'misc/xml-indent-2.sql',
  'misc/xml-indent-3.sql',
  'misc/xml-indent-4.sql',
  'misc/xml-indent-5.sql'
]);
prettyTest.generateTests();
