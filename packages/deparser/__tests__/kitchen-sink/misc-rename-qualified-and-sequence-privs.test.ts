
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-rename-qualified-and-sequence-privs', async () => {
  await fixtures.runFixtureTests([
  "misc/rename-qualified-and-sequence-privs-1.sql",
  "misc/rename-qualified-and-sequence-privs-2.sql",
  "misc/rename-qualified-and-sequence-privs-3.sql",
  "misc/rename-qualified-and-sequence-privs-4.sql",
  "misc/rename-qualified-and-sequence-privs-5.sql",
  "misc/rename-qualified-and-sequence-privs-6.sql"
]);
});
