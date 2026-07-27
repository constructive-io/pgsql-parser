
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-rules-create', async () => {
  await fixtures.runFixtureTests([
  "original/rules/create-1.sql",
  "original/rules/create-2.sql",
  "original/rules/create-3.sql",
  "original/rules/create-4.sql",
  "original/rules/create-5.sql",
  "original/rules/create-6.sql",
  "original/rules/create-7.sql",
  "original/rules/create-8.sql"
]);
});
