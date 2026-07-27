
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-txid', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/txid-1.sql",
  "original/upstream/txid-2.sql",
  "original/upstream/txid-3.sql",
  "original/upstream/txid-4.sql",
  "original/upstream/txid-5.sql",
  "original/upstream/txid-6.sql",
  "original/upstream/txid-7.sql",
  "original/upstream/txid-8.sql",
  "original/upstream/txid-9.sql",
  "original/upstream/txid-10.sql",
  "original/upstream/txid-11.sql",
  "original/upstream/txid-12.sql",
  "original/upstream/txid-13.sql",
  "original/upstream/txid-14.sql",
  "original/upstream/txid-15.sql",
  "original/upstream/txid-16.sql",
  "original/upstream/txid-17.sql",
  "original/upstream/txid-18.sql",
  "original/upstream/txid-19.sql",
  "original/upstream/txid-20.sql",
  "original/upstream/txid-21.sql",
  "original/upstream/txid-22.sql",
  "original/upstream/txid-23.sql"
]);
});
