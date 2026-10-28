
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-xmlserialize-indent', async () => {
  await fixtures.runFixtureTests([
  "misc/xmlserialize-indent-1.sql",
  "misc/xmlserialize-indent-2.sql",
  "misc/xmlserialize-indent-3.sql",
  "misc/xmlserialize-indent-4.sql"
]);
});
