import { PrettyTest } from '../../test-utils/PrettyTest';

const prettyTest = new PrettyTest([
  'pretty/joins-1.sql',
  'pretty/joins-2.sql',
  'pretty/joins-3.sql',
  'pretty/joins-4.sql',
  'pretty/joins-5.sql',
]);

prettyTest.generateTests();
