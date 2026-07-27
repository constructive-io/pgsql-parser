
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-simple', async () => {
  await fixtures.runFixtureTests([
  "original/simple-1.sql",
  "original/simple-2.sql",
  "original/simple-3.sql",
  "original/simple-4.sql",
  "original/simple-5.sql",
  "original/simple-6.sql",
  "original/simple-7.sql",
  "original/simple-8.sql",
  "original/simple-9.sql",
  "original/simple-10.sql",
  "original/simple-11.sql",
  "original/simple-12.sql",
  "original/simple-13.sql",
  "original/simple-14.sql",
  "original/simple-15.sql",
  "original/simple-16.sql",
  "original/simple-17.sql",
  "original/simple-18.sql"
]);
});
