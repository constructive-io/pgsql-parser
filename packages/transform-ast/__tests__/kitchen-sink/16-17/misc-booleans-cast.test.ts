
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('misc-booleans-cast', async () => {
  await fixtures.runFixtureTests([
  "misc/booleans-cast-1.sql",
  "misc/booleans-cast-2.sql",
  "misc/booleans-cast-3.sql"
]);
});
