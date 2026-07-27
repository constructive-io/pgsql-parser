
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-sequences-sequences', async () => {
  await fixtures.runFixtureTests([
  "original/sequences/sequences-1.sql",
  "original/sequences/sequences-2.sql",
  "original/sequences/sequences-3.sql",
  "original/sequences/sequences-4.sql",
  "original/sequences/sequences-5.sql"
]);
});
