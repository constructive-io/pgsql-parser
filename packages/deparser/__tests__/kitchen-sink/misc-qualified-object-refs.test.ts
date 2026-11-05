
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-qualified-object-refs', async () => {
  await fixtures.runFixtureTests([
  "misc/qualified-object-refs-1.sql",
  "misc/qualified-object-refs-2.sql",
  "misc/qualified-object-refs-3.sql",
  "misc/qualified-object-refs-4.sql",
  "misc/qualified-object-refs-5.sql",
  "misc/qualified-object-refs-6.sql",
  "misc/qualified-object-refs-7.sql",
  "misc/qualified-object-refs-8.sql",
  "misc/qualified-object-refs-9.sql",
  "misc/qualified-object-refs-10.sql"
]);
});
