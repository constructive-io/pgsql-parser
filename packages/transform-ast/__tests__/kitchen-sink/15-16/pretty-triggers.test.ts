
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('pretty-triggers', async () => {
  await fixtures.runFixtureTests([
  "pretty/triggers-1.sql",
  "pretty/triggers-2.sql",
  "pretty/triggers-3.sql",
  "pretty/triggers-4.sql",
  "pretty/triggers-5.sql",
  "pretty/triggers-6.sql",
  "pretty/triggers-7.sql",
  "pretty/triggers-8.sql",
  "pretty/triggers-9.sql",
  "pretty/triggers-10.sql"
]);
});
