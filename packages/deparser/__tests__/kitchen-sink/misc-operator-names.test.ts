
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-operator-names', async () => {
  await fixtures.runFixtureTests([
  "misc/operator-names-1.sql",
  "misc/operator-names-2.sql",
  "misc/operator-names-3.sql",
  "misc/operator-names-4.sql",
  "misc/operator-names-5.sql",
  "misc/operator-names-6.sql",
  "misc/operator-names-7.sql",
  "misc/operator-names-8.sql",
  "misc/operator-names-9.sql",
  "misc/operator-names-10.sql",
  "misc/operator-names-11.sql",
  "misc/operator-names-12.sql",
  "misc/operator-names-13.sql",
  "misc/operator-names-14.sql",
  "misc/operator-names-15.sql",
  "misc/operator-names-16.sql",
  "misc/operator-names-17.sql",
  "misc/operator-names-18.sql"
]);
});
