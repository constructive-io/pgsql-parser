
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('pretty-create_policy', async () => {
  await fixtures.runFixtureTests([
  "pretty/create_policy-1.sql",
  "pretty/create_policy-2.sql",
  "pretty/create_policy-3.sql",
  "pretty/create_policy-4.sql",
  "pretty/create_policy-5.sql",
  "pretty/create_policy-6.sql",
  "pretty/create_policy-7.sql"
]);
});
