
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('latest-postgres-event_trigger', async () => {
  await fixtures.runFixtureTests([]);
});
