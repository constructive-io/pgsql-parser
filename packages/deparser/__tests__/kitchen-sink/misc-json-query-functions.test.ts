
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-json-query-functions', async () => {
  await fixtures.runFixtureTests([
  "misc/json-query-functions-1.sql",
  "misc/json-query-functions-2.sql",
  "misc/json-query-functions-3.sql",
  "misc/json-query-functions-4.sql",
  "misc/json-query-functions-5.sql",
  "misc/json-query-functions-6.sql",
  "misc/json-query-functions-7.sql",
  "misc/json-query-functions-8.sql",
  "misc/json-query-functions-9.sql",
  "misc/json-query-functions-10.sql",
  "misc/json-query-functions-11.sql",
  "misc/json-query-functions-12.sql",
  "misc/json-query-functions-13.sql",
  "misc/json-query-functions-14.sql",
  "misc/json-query-functions-15.sql",
  "misc/json-query-functions-16.sql",
  "misc/json-query-functions-17.sql",
  "misc/json-query-functions-18.sql",
  "misc/json-query-functions-19.sql",
  "misc/json-query-functions-20.sql",
  "misc/json-query-functions-21.sql"
]);
});
