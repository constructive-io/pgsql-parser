
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-param-ref', async () => {
  await fixtures.runFixtureTests([
  "original/param-ref-1.sql",
  "original/param-ref-2.sql"
]);
});
