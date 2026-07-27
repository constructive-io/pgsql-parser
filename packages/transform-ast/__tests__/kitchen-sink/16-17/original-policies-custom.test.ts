
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(16, 17);

it('original-policies-custom', async () => {
  await fixtures.runFixtureTests([
  "original/policies/custom-1.sql",
  "original/policies/custom-2.sql",
  "original/policies/custom-3.sql",
  "original/policies/custom-4.sql",
  "original/policies/custom-5.sql",
  "original/policies/custom-6.sql",
  "original/policies/custom-7.sql",
  "original/policies/custom-8.sql",
  "original/policies/custom-9.sql",
  "original/policies/custom-10.sql",
  "original/policies/custom-11.sql",
  "original/policies/custom-12.sql",
  "original/policies/custom-13.sql",
  "original/policies/custom-14.sql"
]);
});
