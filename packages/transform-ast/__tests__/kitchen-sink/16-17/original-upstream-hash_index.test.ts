
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-upstream-hash_index', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/hash_index-1.sql",
  "original/upstream/hash_index-2.sql",
  "original/upstream/hash_index-3.sql",
  "original/upstream/hash_index-4.sql",
  "original/upstream/hash_index-5.sql",
  "original/upstream/hash_index-6.sql",
  "original/upstream/hash_index-7.sql",
  "original/upstream/hash_index-8.sql",
  "original/upstream/hash_index-9.sql",
  "original/upstream/hash_index-10.sql",
  "original/upstream/hash_index-11.sql",
  "original/upstream/hash_index-12.sql",
  "original/upstream/hash_index-13.sql",
  "original/upstream/hash_index-14.sql",
  "original/upstream/hash_index-15.sql",
  "original/upstream/hash_index-16.sql",
  "original/upstream/hash_index-17.sql",
  "original/upstream/hash_index-18.sql",
  "original/upstream/hash_index-19.sql",
  "original/upstream/hash_index-20.sql",
  "original/upstream/hash_index-21.sql",
  "original/upstream/hash_index-22.sql",
  "original/upstream/hash_index-23.sql",
  "original/upstream/hash_index-24.sql"
]);
});
