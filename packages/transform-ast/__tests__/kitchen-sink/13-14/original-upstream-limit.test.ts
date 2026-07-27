
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-limit', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/limit-1.sql",
  "original/upstream/limit-2.sql",
  "original/upstream/limit-3.sql",
  "original/upstream/limit-4.sql",
  "original/upstream/limit-5.sql",
  "original/upstream/limit-6.sql",
  "original/upstream/limit-7.sql",
  "original/upstream/limit-8.sql",
  "original/upstream/limit-9.sql",
  "original/upstream/limit-10.sql",
  "original/upstream/limit-11.sql",
  "original/upstream/limit-12.sql",
  "original/upstream/limit-13.sql",
  "original/upstream/limit-14.sql",
  "original/upstream/limit-15.sql",
  "original/upstream/limit-16.sql",
  "original/upstream/limit-17.sql",
  "original/upstream/limit-18.sql",
  "original/upstream/limit-19.sql",
  "original/upstream/limit-20.sql",
  "original/upstream/limit-21.sql",
  "original/upstream/limit-22.sql",
  "original/upstream/limit-23.sql",
  "original/upstream/limit-24.sql",
  "original/upstream/limit-25.sql"
]);
});
