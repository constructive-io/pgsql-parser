
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-literal-edge-cases', async () => {
  await fixtures.runFixtureTests([
  "misc/literal-edge-cases-1.sql",
  "misc/literal-edge-cases-2.sql",
  "misc/literal-edge-cases-3.sql",
  "misc/literal-edge-cases-4.sql",
  "misc/literal-edge-cases-5.sql",
  "misc/literal-edge-cases-6.sql",
  "misc/literal-edge-cases-7.sql",
  "misc/literal-edge-cases-8.sql",
  "misc/literal-edge-cases-9.sql",
  "misc/literal-edge-cases-10.sql",
  "misc/literal-edge-cases-11.sql",
  "misc/literal-edge-cases-12.sql",
  "misc/literal-edge-cases-13.sql",
  "misc/literal-edge-cases-14.sql",
  "misc/literal-edge-cases-15.sql",
  "misc/literal-edge-cases-16.sql",
  "misc/literal-edge-cases-17.sql",
  "misc/literal-edge-cases-18.sql",
  "misc/literal-edge-cases-19.sql",
  "misc/literal-edge-cases-20.sql",
  "misc/literal-edge-cases-21.sql"
]);
});
