
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-complex', async () => {
  await fixtures.runFixtureTests([
  "original/complex-1.sql"
]);
});
