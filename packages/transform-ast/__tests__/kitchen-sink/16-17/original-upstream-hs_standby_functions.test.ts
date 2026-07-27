
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-upstream-hs_standby_functions', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/hs_standby_functions-1.sql",
  "original/upstream/hs_standby_functions-2.sql",
  "original/upstream/hs_standby_functions-3.sql",
  "original/upstream/hs_standby_functions-4.sql",
  "original/upstream/hs_standby_functions-5.sql",
  "original/upstream/hs_standby_functions-6.sql",
  "original/upstream/hs_standby_functions-7.sql",
  "original/upstream/hs_standby_functions-8.sql"
]);
});
