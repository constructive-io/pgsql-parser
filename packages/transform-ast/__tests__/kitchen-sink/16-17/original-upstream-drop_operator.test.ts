
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-upstream-drop_operator', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/drop_operator-1.sql",
  "original/upstream/drop_operator-2.sql",
  "original/upstream/drop_operator-3.sql",
  "original/upstream/drop_operator-4.sql",
  "original/upstream/drop_operator-5.sql",
  "original/upstream/drop_operator-6.sql",
  "original/upstream/drop_operator-7.sql",
  "original/upstream/drop_operator-8.sql",
  "original/upstream/drop_operator-9.sql",
  "original/upstream/drop_operator-10.sql",
  "original/upstream/drop_operator-11.sql",
  "original/upstream/drop_operator-12.sql"
]);
});
