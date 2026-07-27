
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-create_cast', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/create_cast-1.sql",
  "original/upstream/create_cast-2.sql",
  "original/upstream/create_cast-3.sql",
  "original/upstream/create_cast-4.sql",
  "original/upstream/create_cast-5.sql",
  "original/upstream/create_cast-6.sql",
  "original/upstream/create_cast-7.sql",
  "original/upstream/create_cast-8.sql",
  "original/upstream/create_cast-9.sql",
  "original/upstream/create_cast-10.sql",
  "original/upstream/create_cast-11.sql",
  "original/upstream/create_cast-12.sql",
  "original/upstream/create_cast-13.sql",
  "original/upstream/create_cast-14.sql",
  "original/upstream/create_cast-15.sql",
  "original/upstream/create_cast-16.sql",
  "original/upstream/create_cast-17.sql",
  "original/upstream/create_cast-18.sql",
  "original/upstream/create_cast-19.sql"
]);
});
