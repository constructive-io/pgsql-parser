
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-types-composite', async () => {
  await fixtures.runFixtureTests([
  "original/types/composite-1.sql"
]);
});
