import { PrettyTest } from '../../test-utils/PrettyTest';

const prettyTest = new PrettyTest([
  'misc/alter-trigger-rename-1.sql',
  'misc/alter-trigger-rename-2.sql',
  'misc/alter-trigger-rename-3.sql'
]);
prettyTest.generateTests();
