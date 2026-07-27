
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-upstream-numerology', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/numerology-1.sql",
  "original/upstream/numerology-2.sql",
  "original/upstream/numerology-3.sql",
  "original/upstream/numerology-4.sql",
  "original/upstream/numerology-5.sql",
  "original/upstream/numerology-6.sql",
  "original/upstream/numerology-7.sql",
  "original/upstream/numerology-8.sql",
  "original/upstream/numerology-9.sql",
  "original/upstream/numerology-10.sql",
  "original/upstream/numerology-11.sql",
  "original/upstream/numerology-12.sql",
  "original/upstream/numerology-13.sql",
  "original/upstream/numerology-14.sql",
  "original/upstream/numerology-15.sql",
  "original/upstream/numerology-16.sql",
  "original/upstream/numerology-17.sql",
  "original/upstream/numerology-18.sql",
  "original/upstream/numerology-19.sql",
  "original/upstream/numerology-20.sql",
  "original/upstream/numerology-21.sql",
  "original/upstream/numerology-22.sql",
  "original/upstream/numerology-23.sql",
  "original/upstream/numerology-24.sql"
]);
});
