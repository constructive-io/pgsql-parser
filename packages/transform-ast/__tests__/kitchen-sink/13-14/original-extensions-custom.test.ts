
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-extensions-custom', async () => {
  await fixtures.runFixtureTests([
  "original/extensions/custom-1.sql",
  "original/extensions/custom-2.sql",
  "original/extensions/custom-3.sql"
]);
});
