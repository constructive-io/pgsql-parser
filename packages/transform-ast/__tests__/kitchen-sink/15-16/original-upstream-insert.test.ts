
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-insert', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/insert-1.sql",
  "original/upstream/insert-2.sql",
  "original/upstream/insert-3.sql",
  "original/upstream/insert-4.sql",
  "original/upstream/insert-5.sql",
  "original/upstream/insert-6.sql",
  "original/upstream/insert-7.sql",
  "original/upstream/insert-8.sql",
  "original/upstream/insert-9.sql",
  "original/upstream/insert-10.sql",
  "original/upstream/insert-11.sql",
  "original/upstream/insert-12.sql",
  "original/upstream/insert-13.sql",
  "original/upstream/insert-14.sql",
  "original/upstream/insert-15.sql",
  "original/upstream/insert-16.sql",
  "original/upstream/insert-17.sql"
]);
});
