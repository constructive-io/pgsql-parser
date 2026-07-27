
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('misc-cascades', async () => {
  await fixtures.runFixtureTests([
  "misc/cascades-1.sql",
  "misc/cascades-2.sql",
  "misc/cascades-3.sql",
  "misc/cascades-4.sql",
  "misc/cascades-5.sql",
  "misc/cascades-6.sql",
  "misc/cascades-7.sql",
  "misc/cascades-8.sql",
  "misc/cascades-9.sql",
  "misc/cascades-10.sql",
  "misc/cascades-11.sql",
  "misc/cascades-12.sql",
  "misc/cascades-13.sql",
  "misc/cascades-14.sql",
  "misc/cascades-15.sql",
  "misc/cascades-16.sql",
  "misc/cascades-17.sql",
  "misc/cascades-18.sql",
  "misc/cascades-19.sql",
  "misc/cascades-20.sql",
  "misc/cascades-21.sql",
  "misc/cascades-22.sql",
  "misc/cascades-23.sql",
  "misc/cascades-24.sql",
  "misc/cascades-25.sql"
]);
});
