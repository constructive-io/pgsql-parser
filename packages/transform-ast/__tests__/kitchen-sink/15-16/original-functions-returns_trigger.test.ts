
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-functions-returns_trigger', async () => {
  await fixtures.runFixtureTests([
  "original/functions/returns_trigger-1.sql"
]);
});
