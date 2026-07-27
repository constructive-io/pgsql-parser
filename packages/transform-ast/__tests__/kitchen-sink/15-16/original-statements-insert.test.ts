
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-statements-insert', async () => {
  await fixtures.runFixtureTests([
  "original/statements/insert-1.sql",
  "original/statements/insert-2.sql",
  "original/statements/insert-3.sql",
  "original/statements/insert-4.sql",
  "original/statements/insert-5.sql",
  "original/statements/insert-6.sql"
]);
});
