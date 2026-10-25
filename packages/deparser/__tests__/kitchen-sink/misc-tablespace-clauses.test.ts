
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-tablespace-clauses', async () => {
  await fixtures.runFixtureTests([
  "misc/tablespace-clauses-1.sql",
  "misc/tablespace-clauses-2.sql",
  "misc/tablespace-clauses-3.sql",
  "misc/tablespace-clauses-4.sql",
  "misc/tablespace-clauses-5.sql",
  "misc/tablespace-clauses-6.sql",
  "misc/tablespace-clauses-7.sql",
  "misc/tablespace-clauses-8.sql",
  "misc/tablespace-clauses-9.sql",
  "misc/tablespace-clauses-10.sql",
  "misc/tablespace-clauses-11.sql",
  "misc/tablespace-clauses-12.sql",
  "misc/tablespace-clauses-13.sql",
  "misc/tablespace-clauses-14.sql",
  "misc/tablespace-clauses-15.sql",
  "misc/tablespace-clauses-16.sql"
]);
});
