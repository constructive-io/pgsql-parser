
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-custom', async () => {
  await fixtures.runFixtureTests([
  "original/custom-1.sql",
  "original/custom-2.sql",
  "original/custom-3.sql",
  "original/custom-4.sql",
  "original/custom-5.sql",
  "original/custom-6.sql",
  "original/custom-7.sql",
  "original/custom-8.sql",
  "original/custom-9.sql",
  "original/custom-10.sql",
  "original/custom-11.sql",
  "original/custom-12.sql",
  "original/custom-13.sql",
  "original/custom-14.sql",
  "original/custom-15.sql",
  "original/custom-16.sql",
  "original/custom-17.sql",
  "original/custom-18.sql",
  "original/custom-19.sql",
  "original/custom-20.sql",
  "original/custom-21.sql",
  "original/custom-22.sql",
  "original/custom-23.sql"
]);
});
