
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('pretty-cte', async () => {
  await fixtures.runFixtureTests([
  "pretty/cte-1.sql",
  "pretty/cte-2.sql",
  "pretty/cte-3.sql",
  "pretty/cte-4.sql"
]);
});
