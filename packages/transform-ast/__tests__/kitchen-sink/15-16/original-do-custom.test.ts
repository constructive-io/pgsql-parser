
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-do-custom', async () => {
  await fixtures.runFixtureTests([
  "original/do/custom-1.sql"
]);
});
