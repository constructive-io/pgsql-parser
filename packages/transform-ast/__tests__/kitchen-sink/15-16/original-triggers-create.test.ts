
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-triggers-create', async () => {
  await fixtures.runFixtureTests([
  "original/triggers/create-1.sql",
  "original/triggers/create-2.sql",
  "original/triggers/create-3.sql",
  "original/triggers/create-4.sql",
  "original/triggers/create-5.sql",
  "original/triggers/create-6.sql",
  "original/triggers/create-7.sql",
  "original/triggers/create-8.sql",
  "original/triggers/create-9.sql",
  "original/triggers/create-10.sql",
  "original/triggers/create-11.sql",
  "original/triggers/create-12.sql"
]);
});
