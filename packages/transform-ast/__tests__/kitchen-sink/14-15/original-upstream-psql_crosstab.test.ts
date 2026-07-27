
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-upstream-psql_crosstab', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/psql_crosstab-1.sql",
  "original/upstream/psql_crosstab-2.sql",
  "original/upstream/psql_crosstab-3.sql",
  "original/upstream/psql_crosstab-4.sql",
  "original/upstream/psql_crosstab-5.sql",
  "original/upstream/psql_crosstab-6.sql",
  "original/upstream/psql_crosstab-7.sql",
  "original/upstream/psql_crosstab-8.sql",
  "original/upstream/psql_crosstab-9.sql",
  "original/upstream/psql_crosstab-10.sql",
  "original/upstream/psql_crosstab-11.sql",
  "original/upstream/psql_crosstab-12.sql",
  "original/upstream/psql_crosstab-13.sql",
  "original/upstream/psql_crosstab-14.sql",
  "original/upstream/psql_crosstab-15.sql",
  "original/upstream/psql_crosstab-16.sql",
  "original/upstream/psql_crosstab-17.sql"
]);
});
