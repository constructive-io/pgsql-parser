
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-define', async () => {
  await fixtures.runFixtureTests([
  "original/define-1.sql"
]);
});
