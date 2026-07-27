
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('pretty-selects', async () => {
  await fixtures.runFixtureTests([
  "pretty/selects-1.sql",
  "pretty/selects-2.sql",
  "pretty/selects-3.sql",
  "pretty/selects-4.sql",
  "pretty/selects-5.sql",
  "pretty/selects-6.sql",
  "pretty/selects-7.sql",
  "pretty/selects-8.sql",
  "pretty/selects-9.sql",
  "pretty/selects-10.sql",
  "pretty/selects-11.sql",
  "pretty/selects-12.sql",
  "pretty/selects-13.sql",
  "pretty/selects-14.sql",
  "pretty/selects-15.sql"
]);
});
