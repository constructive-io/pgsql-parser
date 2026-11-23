
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-operator-names', async () => {
  await fixtures.runFixtureTests([
  "misc/operator-names-1.sql",
  "misc/operator-names-2.sql",
  "misc/operator-names-3.sql"
]);
});
