
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('misc-launchql-ext-default-roles', async () => {
  await fixtures.runFixtureTests([
  "misc/launchql-ext-default-roles-1.sql",
  "misc/launchql-ext-default-roles-2.sql",
  "misc/launchql-ext-default-roles-3.sql"
]);
});
