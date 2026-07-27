
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-query-002', async () => {
  await fixtures.runFixtureTests([
  "original/query-002-1.sql"
]);
});
