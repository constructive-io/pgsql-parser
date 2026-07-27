
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-select_having', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/select_having-1.sql",
  "original/upstream/select_having-2.sql",
  "original/upstream/select_having-3.sql",
  "original/upstream/select_having-4.sql",
  "original/upstream/select_having-5.sql",
  "original/upstream/select_having-6.sql",
  "original/upstream/select_having-7.sql",
  "original/upstream/select_having-8.sql",
  "original/upstream/select_having-9.sql",
  "original/upstream/select_having-10.sql",
  "original/upstream/select_having-11.sql",
  "original/upstream/select_having-12.sql",
  "original/upstream/select_having-13.sql",
  "original/upstream/select_having-14.sql",
  "original/upstream/select_having-15.sql",
  "original/upstream/select_having-16.sql",
  "original/upstream/select_having-17.sql",
  "original/upstream/select_having-18.sql",
  "original/upstream/select_having-19.sql",
  "original/upstream/select_having-20.sql",
  "original/upstream/select_having-21.sql",
  "original/upstream/select_having-22.sql",
  "original/upstream/select_having-23.sql"
]);
});
