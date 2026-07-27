
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-statements-select', async () => {
  await fixtures.runFixtureTests([
  "original/statements/select-1.sql",
  "original/statements/select-2.sql",
  "original/statements/select-3.sql"
]);
});
