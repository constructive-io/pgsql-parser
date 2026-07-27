
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(17, 18);

it('original-complex', async () => {
  await fixtures.runFixtureTests([
  "original/complex-1.sql"
]);
});
