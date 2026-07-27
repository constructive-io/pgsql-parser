
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-statements-cte', async () => {
  await fixtures.runFixtureTests([
  "original/statements/cte-1.sql"
]);
});
