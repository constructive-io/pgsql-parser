
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-policy-quoted-names', async () => {
  await fixtures.runFixtureTests([
  "misc/policy-quoted-names-1.sql",
  "misc/policy-quoted-names-2.sql",
  "misc/policy-quoted-names-3.sql",
  "misc/policy-quoted-names-4.sql",
  "misc/policy-quoted-names-5.sql",
  "misc/policy-quoted-names-6.sql"
]);
});
