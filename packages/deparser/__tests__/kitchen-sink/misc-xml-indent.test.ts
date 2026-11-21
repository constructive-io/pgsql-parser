
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-xml-indent', async () => {
  await fixtures.runFixtureTests([
  "misc/xml-indent-1.sql",
  "misc/xml-indent-2.sql",
  "misc/xml-indent-3.sql",
  "misc/xml-indent-4.sql",
  "misc/xml-indent-5.sql"
]);
});
