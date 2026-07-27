
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('latest-postgres-event_trigger_login', async () => {
  await fixtures.runFixtureTests([]);
});
