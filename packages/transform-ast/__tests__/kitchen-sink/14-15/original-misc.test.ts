
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-misc', async () => {
  await fixtures.runFixtureTests([
  "original/misc-1.sql",
  "original/misc-2.sql",
  "original/misc-3.sql",
  "original/misc-4.sql",
  "original/misc-5.sql",
  "original/misc-6.sql",
  "original/misc-7.sql",
  "original/misc-8.sql"
]);
});
