
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-functions-setof', async () => {
  await fixtures.runFixtureTests([
  "original/functions/setof-1.sql",
  "original/functions/setof-2.sql"
]);
});
