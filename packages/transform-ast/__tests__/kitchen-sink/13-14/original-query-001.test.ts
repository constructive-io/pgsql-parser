
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-query-001', async () => {
  await fixtures.runFixtureTests([
  "original/query-001-1.sql"
]);
});
