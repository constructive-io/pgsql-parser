
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-extensions-custom', async () => {
  await fixtures.runFixtureTests([
  "original/extensions/custom-1.sql",
  "original/extensions/custom-2.sql",
  "original/extensions/custom-3.sql"
]);
});
