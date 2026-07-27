
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-upstream-create_am', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/create_am-1.sql",
  "original/upstream/create_am-2.sql",
  "original/upstream/create_am-3.sql",
  "original/upstream/create_am-4.sql",
  "original/upstream/create_am-5.sql",
  "original/upstream/create_am-6.sql",
  "original/upstream/create_am-7.sql",
  "original/upstream/create_am-8.sql",
  "original/upstream/create_am-9.sql",
  "original/upstream/create_am-10.sql",
  "original/upstream/create_am-11.sql",
  "original/upstream/create_am-12.sql",
  "original/upstream/create_am-13.sql",
  "original/upstream/create_am-14.sql",
  "original/upstream/create_am-15.sql",
  "original/upstream/create_am-16.sql",
  "original/upstream/create_am-17.sql",
  "original/upstream/create_am-18.sql"
]);
});
