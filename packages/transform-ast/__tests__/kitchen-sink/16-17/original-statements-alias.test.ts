
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-statements-alias', async () => {
  await fixtures.runFixtureTests([
  "original/statements/alias-1.sql",
  "original/statements/alias-2.sql",
  "original/statements/alias-3.sql",
  "original/statements/alias-4.sql"
]);
});
