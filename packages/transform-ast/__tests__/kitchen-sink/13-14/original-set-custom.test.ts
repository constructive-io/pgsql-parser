
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-set-custom', async () => {
  await fixtures.runFixtureTests([
  "original/set/custom-1.sql",
  "original/set/custom-2.sql",
  "original/set/custom-3.sql",
  "original/set/custom-4.sql",
  "original/set/custom-5.sql",
  "original/set/custom-6.sql",
  "original/set/custom-7.sql",
  "original/set/custom-8.sql"
]);
});
