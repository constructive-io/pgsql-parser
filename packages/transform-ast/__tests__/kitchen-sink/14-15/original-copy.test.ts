
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-copy', async () => {
  await fixtures.runFixtureTests([
  "original/copy-1.sql"
]);
});
