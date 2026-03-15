
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('original-tables-foreign_table', async () => {
  await fixtures.runFixtureTests([
  "original/tables/foreign_table-1.sql"
]);
});
