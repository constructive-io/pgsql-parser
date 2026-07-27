
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-views-create', async () => {
  await fixtures.runFixtureTests([
  "original/views/create-1.sql",
  "original/views/create-2.sql",
  "original/views/create-3.sql",
  "original/views/create-4.sql"
]);
});
