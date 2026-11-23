
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-typecast', async () => {
  await fixtures.runFixtureTests([
  "misc/typecast-1.sql",
  "misc/typecast-2.sql",
  "misc/typecast-3.sql",
  "misc/typecast-4.sql",
  "misc/typecast-5.sql",
  "misc/typecast-6.sql",
  "misc/typecast-7.sql",
  "misc/typecast-8.sql",
  "misc/typecast-9.sql",
  "misc/typecast-10.sql",
  "misc/typecast-11.sql",
  "misc/typecast-12.sql",
  "misc/typecast-13.sql",
  "misc/typecast-14.sql",
  "misc/typecast-15.sql",
  "misc/typecast-16.sql",
  "misc/typecast-17.sql"
]);
});
