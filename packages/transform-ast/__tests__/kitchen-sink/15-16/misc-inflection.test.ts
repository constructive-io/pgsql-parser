
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('misc-inflection', async () => {
  await fixtures.runFixtureTests([
  "misc/inflection-1.sql",
  "misc/inflection-2.sql",
  "misc/inflection-3.sql",
  "misc/inflection-4.sql",
  "misc/inflection-5.sql",
  "misc/inflection-6.sql",
  "misc/inflection-7.sql",
  "misc/inflection-8.sql",
  "misc/inflection-9.sql",
  "misc/inflection-10.sql",
  "misc/inflection-11.sql",
  "misc/inflection-12.sql",
  "misc/inflection-13.sql",
  "misc/inflection-14.sql",
  "misc/inflection-15.sql",
  "misc/inflection-16.sql",
  "misc/inflection-17.sql",
  "misc/inflection-18.sql",
  "misc/inflection-19.sql",
  "misc/inflection-20.sql",
  "misc/inflection-21.sql",
  "misc/inflection-22.sql",
  "misc/inflection-23.sql",
  "misc/inflection-24.sql",
  "misc/inflection-25.sql",
  "misc/inflection-26.sql"
]);
});
