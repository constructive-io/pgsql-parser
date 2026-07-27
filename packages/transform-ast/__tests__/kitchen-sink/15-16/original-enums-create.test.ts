
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-enums-create', async () => {
  await fixtures.runFixtureTests([
  "original/enums/create-1.sql"
]);
});
