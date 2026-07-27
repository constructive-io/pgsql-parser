
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('misc-launchql-ext-types', async () => {
  await fixtures.runFixtureTests([
  "misc/launchql-ext-types-1.sql",
  "misc/launchql-ext-types-2.sql",
  "misc/launchql-ext-types-3.sql",
  "misc/launchql-ext-types-4.sql",
  "misc/launchql-ext-types-5.sql",
  "misc/launchql-ext-types-6.sql",
  "misc/launchql-ext-types-7.sql",
  "misc/launchql-ext-types-8.sql",
  "misc/launchql-ext-types-9.sql",
  "misc/launchql-ext-types-10.sql",
  "misc/launchql-ext-types-11.sql",
  "misc/launchql-ext-types-12.sql",
  "misc/launchql-ext-types-13.sql",
  "misc/launchql-ext-types-14.sql",
  "misc/launchql-ext-types-15.sql",
  "misc/launchql-ext-types-16.sql"
]);
});
