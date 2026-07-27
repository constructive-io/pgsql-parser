
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('latest-postgres-event_trigger', async () => {
  await fixtures.runFixtureTests([]);
});
