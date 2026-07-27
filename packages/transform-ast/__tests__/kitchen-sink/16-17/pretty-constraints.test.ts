
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('pretty-constraints', async () => {
  await fixtures.runFixtureTests([
  "pretty/constraints-1.sql",
  "pretty/constraints-2.sql",
  "pretty/constraints-3.sql",
  "pretty/constraints-4.sql",
  "pretty/constraints-5.sql",
  "pretty/constraints-6.sql",
  "pretty/constraints-7.sql",
  "pretty/constraints-8.sql",
  "pretty/constraints-9.sql",
  "pretty/constraints-10.sql",
  "pretty/constraints-11.sql",
  "pretty/constraints-12.sql",
  "pretty/constraints-13.sql",
  "pretty/constraints-14.sql",
  "pretty/constraints-15.sql",
  "pretty/constraints-16.sql",
  "pretty/constraints-17.sql"
]);
});
