
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-types-composite', async () => {
  await fixtures.runFixtureTests([
  "original/types/composite-1.sql"
]);
});
