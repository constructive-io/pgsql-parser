
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-call', async () => {
  await fixtures.runFixtureTests([
  "original/call-1.sql",
  "original/call-2.sql",
  "original/call-3.sql"
]);
});
