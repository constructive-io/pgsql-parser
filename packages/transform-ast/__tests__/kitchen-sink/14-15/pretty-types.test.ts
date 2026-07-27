
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('pretty-types', async () => {
  await fixtures.runFixtureTests([
  "pretty/types-1.sql",
  "pretty/types-2.sql",
  "pretty/types-3.sql",
  "pretty/types-4.sql",
  "pretty/types-5.sql",
  "pretty/types-6.sql",
  "pretty/types-7.sql",
  "pretty/types-8.sql",
  "pretty/types-9.sql"
]);
});
