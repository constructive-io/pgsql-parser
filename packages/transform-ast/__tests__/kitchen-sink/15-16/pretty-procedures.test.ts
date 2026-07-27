
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('pretty-procedures', async () => {
  await fixtures.runFixtureTests([
  "pretty/procedures-1.sql",
  "pretty/procedures-2.sql",
  "pretty/procedures-3.sql",
  "pretty/procedures-4.sql",
  "pretty/procedures-5.sql",
  "pretty/procedures-6.sql",
  "pretty/procedures-7.sql",
  "pretty/procedures-8.sql",
  "pretty/procedures-9.sql",
  "pretty/procedures-10.sql"
]);
});
