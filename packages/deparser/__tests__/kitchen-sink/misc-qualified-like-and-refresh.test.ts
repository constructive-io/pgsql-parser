
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-qualified-like-and-refresh', async () => {
  await fixtures.runFixtureTests([
  "misc/qualified-like-and-refresh-1.sql",
  "misc/qualified-like-and-refresh-2.sql",
  "misc/qualified-like-and-refresh-3.sql",
  "misc/qualified-like-and-refresh-4.sql",
  "misc/qualified-like-and-refresh-5.sql",
  "misc/qualified-like-and-refresh-6.sql",
  "misc/qualified-like-and-refresh-7.sql",
  "misc/qualified-like-and-refresh-8.sql"
]);
});
