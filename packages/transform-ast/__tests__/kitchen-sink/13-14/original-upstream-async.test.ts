
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-async', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/async-1.sql",
  "original/upstream/async-2.sql",
  "original/upstream/async-3.sql",
  "original/upstream/async-4.sql",
  "original/upstream/async-5.sql",
  "original/upstream/async-6.sql",
  "original/upstream/async-7.sql",
  "original/upstream/async-8.sql",
  "original/upstream/async-9.sql",
  "original/upstream/async-10.sql",
  "original/upstream/async-11.sql"
]);
});
