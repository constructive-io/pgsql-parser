
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('original-upstream-copydml', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/copydml-1.sql",
  "original/upstream/copydml-2.sql",
  "original/upstream/copydml-3.sql",
  "original/upstream/copydml-4.sql",
  "original/upstream/copydml-5.sql",
  "original/upstream/copydml-6.sql",
  "original/upstream/copydml-7.sql",
  "original/upstream/copydml-8.sql",
  "original/upstream/copydml-9.sql",
  "original/upstream/copydml-10.sql",
  "original/upstream/copydml-11.sql",
  "original/upstream/copydml-12.sql",
  "original/upstream/copydml-13.sql",
  "original/upstream/copydml-14.sql"
]);
});
