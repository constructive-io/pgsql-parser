
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-pg18-partition-ctas', async () => {
  await fixtures.runFixtureTests([
  "misc/pg18-partition-ctas-1.sql",
  "misc/pg18-partition-ctas-2.sql",
  "misc/pg18-partition-ctas-3.sql",
  "misc/pg18-partition-ctas-4.sql",
  "misc/pg18-partition-ctas-5.sql",
  "misc/pg18-partition-ctas-6.sql",
  "misc/pg18-partition-ctas-7.sql",
  "misc/pg18-partition-ctas-8.sql",
  "misc/pg18-partition-ctas-9.sql",
  "misc/pg18-partition-ctas-10.sql",
  "misc/pg18-partition-ctas-11.sql",
  "misc/pg18-partition-ctas-12.sql",
  "misc/pg18-partition-ctas-13.sql",
  "misc/pg18-partition-ctas-14.sql",
  "misc/pg18-partition-ctas-15.sql",
  "misc/pg18-partition-ctas-16.sql",
  "misc/pg18-partition-ctas-17.sql"
]);
});
