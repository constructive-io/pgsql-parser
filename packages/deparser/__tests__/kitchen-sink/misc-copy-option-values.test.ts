
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-copy-option-values', async () => {
  await fixtures.runFixtureTests([
  "misc/copy-option-values-1.sql",
  "misc/copy-option-values-2.sql",
  "misc/copy-option-values-3.sql",
  "misc/copy-option-values-4.sql"
]);
});
