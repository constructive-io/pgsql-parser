
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('original-enums-alter', async () => {
  await fixtures.runFixtureTests([
  "original/enums/alter-1.sql",
  "original/enums/alter-2.sql",
  "original/enums/alter-3.sql",
  "original/enums/alter-4.sql",
  "original/enums/alter-5.sql",
  "original/enums/alter-6.sql",
  "original/enums/alter-7.sql"
]);
});
