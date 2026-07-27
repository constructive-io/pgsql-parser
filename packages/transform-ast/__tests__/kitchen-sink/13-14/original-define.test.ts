
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-define', async () => {
  await fixtures.runFixtureTests([
  "original/define-1.sql"
]);
});
