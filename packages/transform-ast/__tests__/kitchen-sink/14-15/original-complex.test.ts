
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-complex', async () => {
  await fixtures.runFixtureTests([
  "original/complex-1.sql"
]);
});
