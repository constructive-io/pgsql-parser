
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-copy', async () => {
  await fixtures.runFixtureTests([
  "original/copy-1.sql"
]);
});
