
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-views-replace', async () => {
  await fixtures.runFixtureTests([
  "original/views/replace-1.sql"
]);
});
