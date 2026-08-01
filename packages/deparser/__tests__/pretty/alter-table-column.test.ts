import { PrettyTest } from '../../test-utils/PrettyTest';
const prettyTest = new PrettyTest([
  'original/alter/alter-table-column-1.sql',
  'original/alter/alter-table-column-2.sql',
  'original/alter/alter-table-column-3.sql',
  'original/alter/alter-table-column-4.sql',
  'original/alter/alter-table-column-5.sql',
  'original/alter/alter-table-column-6.sql',
  'original/alter/alter-table-column-7.sql',
  'original/alter/alter-table-column-8.sql',
  'original/alter/alter-table-column-9.sql'
]);

prettyTest.generateTests();
