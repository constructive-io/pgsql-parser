
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-hs_standby_allowed', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/hs_standby_allowed-1.sql",
  "original/upstream/hs_standby_allowed-2.sql",
  "original/upstream/hs_standby_allowed-3.sql"
]);
});
