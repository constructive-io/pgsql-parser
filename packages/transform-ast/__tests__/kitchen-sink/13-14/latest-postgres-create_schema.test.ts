
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(13, 14);

it('latest-postgres-create_schema', async () => {
  await fixtures.runFixtureTests([
  "latest/postgres/create_schema-1.sql",
  "latest/postgres/create_schema-2.sql",
  "latest/postgres/create_schema-3.sql",
  "latest/postgres/create_schema-4.sql",
  "latest/postgres/create_schema-5.sql",
  "latest/postgres/create_schema-6.sql",
  "latest/postgres/create_schema-7.sql",
  "latest/postgres/create_schema-8.sql",
  "latest/postgres/create_schema-9.sql",
  "latest/postgres/create_schema-10.sql",
  "latest/postgres/create_schema-11.sql",
  "latest/postgres/create_schema-12.sql",
  "latest/postgres/create_schema-13.sql",
  "latest/postgres/create_schema-14.sql",
  "latest/postgres/create_schema-15.sql",
  "latest/postgres/create_schema-16.sql",
  "latest/postgres/create_schema-17.sql",
  "latest/postgres/create_schema-18.sql",
  "latest/postgres/create_schema-19.sql",
  "latest/postgres/create_schema-20.sql",
  "latest/postgres/create_schema-21.sql",
  "latest/postgres/create_schema-22.sql",
  "latest/postgres/create_schema-23.sql",
  "latest/postgres/create_schema-24.sql",
  "latest/postgres/create_schema-25.sql",
  "latest/postgres/create_schema-26.sql",
  "latest/postgres/create_schema-27.sql"
]);
});
