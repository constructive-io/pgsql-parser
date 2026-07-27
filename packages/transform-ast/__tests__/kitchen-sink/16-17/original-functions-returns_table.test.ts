
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-functions-returns_table', async () => {
  await fixtures.runFixtureTests([
  "original/functions/returns_table-1.sql"
]);
});
