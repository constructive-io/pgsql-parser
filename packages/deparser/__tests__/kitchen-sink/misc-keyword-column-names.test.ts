
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-keyword-column-names', async () => {
  await fixtures.runFixtureTests([
  "misc/keyword-column-names-1.sql",
  "misc/keyword-column-names-2.sql",
  "misc/keyword-column-names-3.sql",
  "misc/keyword-column-names-4.sql",
  "misc/keyword-column-names-5.sql",
  "misc/keyword-column-names-6.sql"
]);
});
