
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-pg18-publication-subscription', async () => {
  await fixtures.runFixtureTests([
  "misc/pg18-publication-subscription-1.sql",
  "misc/pg18-publication-subscription-2.sql",
  "misc/pg18-publication-subscription-3.sql",
  "misc/pg18-publication-subscription-4.sql",
  "misc/pg18-publication-subscription-5.sql",
  "misc/pg18-publication-subscription-6.sql",
  "misc/pg18-publication-subscription-7.sql",
  "misc/pg18-publication-subscription-8.sql",
  "misc/pg18-publication-subscription-9.sql",
  "misc/pg18-publication-subscription-10.sql",
  "misc/pg18-publication-subscription-11.sql",
  "misc/pg18-publication-subscription-12.sql",
  "misc/pg18-publication-subscription-13.sql",
  "misc/pg18-publication-subscription-14.sql",
  "misc/pg18-publication-subscription-15.sql",
  "misc/pg18-publication-subscription-16.sql",
  "misc/pg18-publication-subscription-17.sql",
  "misc/pg18-publication-subscription-18.sql",
  "misc/pg18-publication-subscription-19.sql",
  "misc/pg18-publication-subscription-20.sql",
  "misc/pg18-publication-subscription-21.sql",
  "misc/pg18-publication-subscription-22.sql",
  "misc/pg18-publication-subscription-23.sql",
  "misc/pg18-publication-subscription-24.sql",
  "misc/pg18-publication-subscription-25.sql",
  "misc/pg18-publication-subscription-26.sql",
  "misc/pg18-publication-subscription-27.sql",
  "misc/pg18-publication-subscription-28.sql",
  "misc/pg18-publication-subscription-29.sql",
  "misc/pg18-publication-subscription-30.sql",
  "misc/pg18-publication-subscription-31.sql"
]);
});
