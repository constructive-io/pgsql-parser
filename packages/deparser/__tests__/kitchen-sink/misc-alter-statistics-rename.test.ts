
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-alter-statistics-rename', async () => {
  await fixtures.runFixtureTests([
  "misc/alter-statistics-rename-1.sql",
  "misc/alter-statistics-rename-2.sql",
  "misc/alter-statistics-rename-3.sql"
]);
});
