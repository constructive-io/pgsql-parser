
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-upstream-sanity_check', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/sanity_check-1.sql",
  "original/upstream/sanity_check-2.sql",
  "original/upstream/sanity_check-3.sql"
]);
});
