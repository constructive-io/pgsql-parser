
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-hs_primary_setup', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/hs_primary_setup-1.sql",
  "original/upstream/hs_primary_setup-2.sql",
  "original/upstream/hs_primary_setup-3.sql",
  "original/upstream/hs_primary_setup-4.sql",
  "original/upstream/hs_primary_setup-5.sql",
  "original/upstream/hs_primary_setup-6.sql",
  "original/upstream/hs_primary_setup-7.sql",
  "original/upstream/hs_primary_setup-8.sql",
  "original/upstream/hs_primary_setup-9.sql",
  "original/upstream/hs_primary_setup-10.sql",
  "original/upstream/hs_primary_setup-11.sql",
  "original/upstream/hs_primary_setup-12.sql",
  "original/upstream/hs_primary_setup-13.sql",
  "original/upstream/hs_primary_setup-14.sql",
  "original/upstream/hs_primary_setup-15.sql"
]);
});
