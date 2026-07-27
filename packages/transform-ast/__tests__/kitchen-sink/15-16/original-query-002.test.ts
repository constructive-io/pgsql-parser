
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-query-002', async () => {
  await fixtures.runFixtureTests([
  "original/query-002-1.sql"
]);
});
