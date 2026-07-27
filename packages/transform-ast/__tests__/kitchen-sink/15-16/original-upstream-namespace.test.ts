
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-namespace', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/namespace-1.sql",
  "original/upstream/namespace-2.sql",
  "original/upstream/namespace-3.sql",
  "original/upstream/namespace-4.sql",
  "original/upstream/namespace-5.sql",
  "original/upstream/namespace-6.sql",
  "original/upstream/namespace-7.sql",
  "original/upstream/namespace-8.sql",
  "original/upstream/namespace-9.sql",
  "original/upstream/namespace-10.sql",
  "original/upstream/namespace-11.sql",
  "original/upstream/namespace-12.sql",
  "original/upstream/namespace-13.sql"
]);
});
