
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-alter-statistics', async () => {
  await fixtures.runFixtureTests([
  "misc/alter-statistics-1.sql",
  "misc/alter-statistics-2.sql",
  "misc/alter-statistics-3.sql"
]);
});
