
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-index-clause-ordering', async () => {
  await fixtures.runFixtureTests([
  "misc/index-clause-ordering-1.sql",
  "misc/index-clause-ordering-2.sql",
  "misc/index-clause-ordering-3.sql",
  "misc/index-clause-ordering-4.sql",
  "misc/index-clause-ordering-5.sql",
  "misc/index-clause-ordering-6.sql",
  "misc/index-clause-ordering-7.sql",
  "misc/index-clause-ordering-8.sql",
  "misc/index-clause-ordering-9.sql",
  "misc/index-clause-ordering-10.sql",
  "misc/index-clause-ordering-11.sql",
  "misc/index-clause-ordering-12.sql"
]);
});
