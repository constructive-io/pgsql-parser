
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-views-replace', async () => {
  await fixtures.runFixtureTests([
  "original/views/replace-1.sql"
]);
});
