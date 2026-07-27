
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-upstream-path', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/path-1.sql",
  "original/upstream/path-2.sql",
  "original/upstream/path-3.sql",
  "original/upstream/path-4.sql",
  "original/upstream/path-5.sql",
  "original/upstream/path-6.sql",
  "original/upstream/path-7.sql",
  "original/upstream/path-8.sql",
  "original/upstream/path-9.sql",
  "original/upstream/path-10.sql",
  "original/upstream/path-11.sql",
  "original/upstream/path-12.sql",
  "original/upstream/path-13.sql",
  "original/upstream/path-14.sql",
  "original/upstream/path-15.sql",
  "original/upstream/path-16.sql"
]);
});
