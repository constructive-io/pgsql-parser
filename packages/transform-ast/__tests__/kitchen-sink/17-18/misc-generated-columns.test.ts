
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(17, 18);

it('misc-generated-columns', async () => {
  await fixtures.runFixtureTests([
  "misc/generated-columns-1.sql",
  "misc/generated-columns-2.sql",
  "misc/generated-columns-3.sql",
  "misc/generated-columns-4.sql",
  "misc/generated-columns-5.sql",
  "misc/generated-columns-6.sql",
  "misc/generated-columns-7.sql",
  "misc/generated-columns-8.sql"
]);
});
