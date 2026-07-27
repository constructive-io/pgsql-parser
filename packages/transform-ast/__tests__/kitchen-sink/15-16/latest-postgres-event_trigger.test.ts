
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('latest-postgres-event_trigger', async () => {
  await fixtures.runFixtureTests([]);
});
