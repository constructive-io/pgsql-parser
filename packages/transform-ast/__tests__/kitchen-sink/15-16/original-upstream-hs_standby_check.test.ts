
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-hs_standby_check', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/hs_standby_check-1.sql"
]);
});
