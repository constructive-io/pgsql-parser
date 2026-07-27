
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-upstream-varchar', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/varchar-1.sql",
  "original/upstream/varchar-2.sql",
  "original/upstream/varchar-3.sql",
  "original/upstream/varchar-4.sql",
  "original/upstream/varchar-5.sql",
  "original/upstream/varchar-6.sql",
  "original/upstream/varchar-7.sql",
  "original/upstream/varchar-8.sql",
  "original/upstream/varchar-9.sql",
  "original/upstream/varchar-10.sql",
  "original/upstream/varchar-11.sql",
  "original/upstream/varchar-12.sql",
  "original/upstream/varchar-13.sql",
  "original/upstream/varchar-14.sql",
  "original/upstream/varchar-15.sql",
  "original/upstream/varchar-16.sql",
  "original/upstream/varchar-17.sql",
  "original/upstream/varchar-18.sql",
  "original/upstream/varchar-19.sql",
  "original/upstream/varchar-20.sql",
  "original/upstream/varchar-21.sql",
  "original/upstream/varchar-22.sql",
  "original/upstream/varchar-23.sql",
  "original/upstream/varchar-24.sql"
]);
});
