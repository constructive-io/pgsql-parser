import { PrettyTest } from '../../test-utils/PrettyTest';

const prettyTest = new PrettyTest([
  'misc/alter-statistics-rename-1.sql',
  'misc/alter-statistics-rename-2.sql',
  'misc/alter-statistics-rename-3.sql'
]);
prettyTest.generateTests();
