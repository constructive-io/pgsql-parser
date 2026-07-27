
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-parens', async () => {
  await fixtures.runFixtureTests([
  "original/parens-1.sql",
  "original/parens-2.sql",
  "original/parens-3.sql",
  "original/parens-4.sql",
  "original/parens-5.sql",
  "original/parens-6.sql",
  "original/parens-7.sql",
  "original/parens-8.sql",
  "original/parens-9.sql",
  "original/parens-10.sql",
  "original/parens-11.sql",
  "original/parens-12.sql"
]);
});
