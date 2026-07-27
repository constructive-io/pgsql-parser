
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-functions-do', async () => {
  await fixtures.runFixtureTests([
  "original/functions/do-1.sql",
  "original/functions/do-2.sql",
  "original/functions/do-3.sql"
]);
});
