
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-functions-basic', async () => {
  await fixtures.runFixtureTests([
  "original/functions/basic-1.sql",
  "original/functions/basic-2.sql"
]);
});
