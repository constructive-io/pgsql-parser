
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-select_distinct', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/select_distinct-1.sql",
  "original/upstream/select_distinct-2.sql",
  "original/upstream/select_distinct-3.sql",
  "original/upstream/select_distinct-4.sql",
  "original/upstream/select_distinct-5.sql",
  "original/upstream/select_distinct-6.sql",
  "original/upstream/select_distinct-7.sql",
  "original/upstream/select_distinct-8.sql",
  "original/upstream/select_distinct-9.sql",
  "original/upstream/select_distinct-10.sql",
  "original/upstream/select_distinct-11.sql",
  "original/upstream/select_distinct-12.sql",
  "original/upstream/select_distinct-13.sql",
  "original/upstream/select_distinct-14.sql",
  "original/upstream/select_distinct-15.sql",
  "original/upstream/select_distinct-16.sql",
  "original/upstream/select_distinct-17.sql",
  "original/upstream/select_distinct-18.sql",
  "original/upstream/select_distinct-19.sql",
  "original/upstream/select_distinct-20.sql",
  "original/upstream/select_distinct-21.sql",
  "original/upstream/select_distinct-22.sql"
]);
});
