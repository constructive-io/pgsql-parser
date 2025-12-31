import { PlpgsqlPrettyTest } from '../../test-utils';

const prettyTest = new PlpgsqlPrettyTest([
  'simple-function.sql',
  'if-else-function.sql',
  'loop-function.sql',
]);

prettyTest.generateTests();
