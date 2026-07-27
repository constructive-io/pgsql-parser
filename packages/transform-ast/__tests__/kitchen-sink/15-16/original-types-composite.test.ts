
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-types-composite', async () => {
  await fixtures.runFixtureTests([
  "original/types/composite-1.sql"
]);
});
