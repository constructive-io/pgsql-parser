
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-conversion', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/conversion-1.sql",
  "original/upstream/conversion-2.sql",
  "original/upstream/conversion-3.sql",
  "original/upstream/conversion-4.sql",
  "original/upstream/conversion-5.sql",
  "original/upstream/conversion-6.sql",
  "original/upstream/conversion-7.sql",
  "original/upstream/conversion-8.sql",
  "original/upstream/conversion-9.sql",
  "original/upstream/conversion-10.sql",
  "original/upstream/conversion-11.sql",
  "original/upstream/conversion-12.sql",
  "original/upstream/conversion-13.sql"
]);
});
