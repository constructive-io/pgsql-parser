
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-preceeding', async () => {
  await fixtures.runFixtureTests([
  "original/preceeding-1.sql"
]);
});
