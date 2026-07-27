
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-upstream-psql', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/psql-1.sql",
  "original/upstream/psql-2.sql",
  "original/upstream/psql-3.sql",
  "original/upstream/psql-4.sql",
  "original/upstream/psql-5.sql",
  "original/upstream/psql-6.sql",
  "original/upstream/psql-7.sql",
  "original/upstream/psql-8.sql",
  "original/upstream/psql-9.sql"
]);
});
