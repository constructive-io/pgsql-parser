
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-pg18-cte-insert', async () => {
  await fixtures.runFixtureTests([
  "misc/pg18-cte-insert-1.sql",
  "misc/pg18-cte-insert-2.sql",
  "misc/pg18-cte-insert-3.sql",
  "misc/pg18-cte-insert-4.sql",
  "misc/pg18-cte-insert-5.sql",
  "misc/pg18-cte-insert-6.sql",
  "misc/pg18-cte-insert-7.sql",
  "misc/pg18-cte-insert-8.sql",
  "misc/pg18-cte-insert-9.sql",
  "misc/pg18-cte-insert-10.sql",
  "misc/pg18-cte-insert-11.sql",
  "misc/pg18-cte-insert-12.sql",
  "misc/pg18-cte-insert-13.sql"
]);
});
