
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-statements-update', async () => {
  await fixtures.runFixtureTests([
  "original/statements/update-1.sql",
  "original/statements/update-2.sql",
  "original/statements/update-3.sql",
  "original/statements/update-4.sql",
  "original/statements/update-5.sql",
  "original/statements/update-6.sql",
  "original/statements/update-7.sql",
  "original/statements/update-8.sql",
  "original/statements/update-9.sql",
  "original/statements/update-10.sql",
  "original/statements/update-11.sql",
  "original/statements/update-12.sql"
]);
});
