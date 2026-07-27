
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-sequences-alter', async () => {
  await fixtures.runFixtureTests([
  "original/sequences/alter-1.sql",
  "original/sequences/alter-2.sql",
  "original/sequences/alter-3.sql",
  "original/sequences/alter-4.sql",
  "original/sequences/alter-5.sql"
]);
});
