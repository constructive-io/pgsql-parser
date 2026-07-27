
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-misc_functions', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/misc_functions-1.sql",
  "original/upstream/misc_functions-2.sql",
  "original/upstream/misc_functions-3.sql",
  "original/upstream/misc_functions-4.sql",
  "original/upstream/misc_functions-5.sql",
  "original/upstream/misc_functions-6.sql",
  "original/upstream/misc_functions-7.sql",
  "original/upstream/misc_functions-8.sql",
  "original/upstream/misc_functions-9.sql",
  "original/upstream/misc_functions-10.sql",
  "original/upstream/misc_functions-11.sql",
  "original/upstream/misc_functions-12.sql",
  "original/upstream/misc_functions-13.sql",
  "original/upstream/misc_functions-14.sql",
  "original/upstream/misc_functions-15.sql",
  "original/upstream/misc_functions-16.sql",
  "original/upstream/misc_functions-17.sql",
  "original/upstream/misc_functions-18.sql",
  "original/upstream/misc_functions-19.sql",
  "original/upstream/misc_functions-20.sql",
  "original/upstream/misc_functions-21.sql",
  "original/upstream/misc_functions-22.sql"
]);
});
