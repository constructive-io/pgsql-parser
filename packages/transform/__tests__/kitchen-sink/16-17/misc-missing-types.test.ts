
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('misc-missing-types', async () => {
  await fixtures.runFixtureTests([
  "misc/missing-types-1.sql",
  "misc/missing-types-2.sql",
  "misc/missing-types-3.sql",
  "misc/missing-types-4.sql",
  "misc/missing-types-5.sql",
  "misc/missing-types-6.sql",
  "misc/missing-types-7.sql",
  "misc/missing-types-8.sql",
  "misc/missing-types-9.sql",
  "misc/missing-types-10.sql",
  "misc/missing-types-11.sql",
  "misc/missing-types-12.sql",
  "misc/missing-types-13.sql",
  "misc/missing-types-14.sql"
]);
});
