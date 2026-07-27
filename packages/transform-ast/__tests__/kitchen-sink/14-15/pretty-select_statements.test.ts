
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('pretty-select_statements', async () => {
  await fixtures.runFixtureTests([
  "pretty/select_statements-1.sql",
  "pretty/select_statements-2.sql",
  "pretty/select_statements-3.sql",
  "pretty/select_statements-4.sql",
  "pretty/select_statements-5.sql",
  "pretty/select_statements-6.sql"
]);
});
