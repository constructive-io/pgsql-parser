
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-define', async () => {
  await fixtures.runFixtureTests([
  "original/define-1.sql"
]);
});
