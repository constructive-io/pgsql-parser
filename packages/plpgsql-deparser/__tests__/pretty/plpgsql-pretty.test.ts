import { PlpgsqlPrettyTest } from '../../test-utils';

const prettyTest = new PlpgsqlPrettyTest([
  'big-function.sql',
  'simple-function.sql',
  'if-else-function.sql',
  'loop-function.sql',
]);

prettyTest.generateTests();
