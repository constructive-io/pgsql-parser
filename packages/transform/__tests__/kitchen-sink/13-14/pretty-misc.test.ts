
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('pretty-misc', async () => {
  await fixtures.runFixtureTests([
  "pretty/misc-1.sql",
  "pretty/misc-2.sql",
  "pretty/misc-3.sql",
  "pretty/misc-4.sql",
  "pretty/misc-5.sql",
  "pretty/misc-6.sql",
  "pretty/misc-7.sql",
  "pretty/misc-8.sql",
  "pretty/misc-9.sql",
  "pretty/misc-10.sql",
  "pretty/misc-11.sql",
  "pretty/misc-12.sql",
  "pretty/misc-13.sql",
  "pretty/misc-14.sql",
  "pretty/misc-15.sql",
  "pretty/misc-16.sql",
  "pretty/misc-17.sql"
]);
});
