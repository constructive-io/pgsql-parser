
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-complex', async () => {
  await fixtures.runFixtureTests([
  "original/complex-1.sql"
]);
});
