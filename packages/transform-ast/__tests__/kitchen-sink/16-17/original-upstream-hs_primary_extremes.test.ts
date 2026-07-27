
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-upstream-hs_primary_extremes', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/hs_primary_extremes-1.sql",
  "original/upstream/hs_primary_extremes-2.sql",
  "original/upstream/hs_primary_extremes-3.sql",
  "original/upstream/hs_primary_extremes-4.sql",
  "original/upstream/hs_primary_extremes-5.sql",
  "original/upstream/hs_primary_extremes-6.sql",
  "original/upstream/hs_primary_extremes-7.sql",
  "original/upstream/hs_primary_extremes-8.sql",
  "original/upstream/hs_primary_extremes-9.sql",
  "original/upstream/hs_primary_extremes-10.sql",
  "original/upstream/hs_primary_extremes-11.sql",
  "original/upstream/hs_primary_extremes-12.sql",
  "original/upstream/hs_primary_extremes-13.sql",
  "original/upstream/hs_primary_extremes-14.sql",
  "original/upstream/hs_primary_extremes-15.sql",
  "original/upstream/hs_primary_extremes-16.sql",
  "original/upstream/hs_primary_extremes-17.sql",
  "original/upstream/hs_primary_extremes-18.sql",
  "original/upstream/hs_primary_extremes-19.sql",
  "original/upstream/hs_primary_extremes-20.sql",
  "original/upstream/hs_primary_extremes-21.sql",
  "original/upstream/hs_primary_extremes-22.sql",
  "original/upstream/hs_primary_extremes-23.sql",
  "original/upstream/hs_primary_extremes-24.sql"
]);
});
