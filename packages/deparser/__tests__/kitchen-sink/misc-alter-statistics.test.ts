
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-alter-statistics', async () => {
  await fixtures.runFixtureTests([
  "misc/alter-statistics-1.sql",
  "misc/alter-statistics-2.sql",
  "misc/alter-statistics-3.sql",
  "misc/alter-statistics-4.sql",
  "misc/alter-statistics-5.sql",
  "misc/alter-statistics-6.sql",
  "misc/alter-statistics-7.sql",
  "misc/alter-statistics-8.sql",
  "misc/alter-statistics-9.sql"
]);
});
