
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(14, 15);

it('latest-postgres-create_cast', async () => {
  await fixtures.runFixtureTests([
  "latest/postgres/create_cast-1.sql",
  "latest/postgres/create_cast-2.sql",
  "latest/postgres/create_cast-3.sql",
  "latest/postgres/create_cast-4.sql",
  "latest/postgres/create_cast-5.sql",
  "latest/postgres/create_cast-6.sql",
  "latest/postgres/create_cast-7.sql",
  "latest/postgres/create_cast-8.sql",
  "latest/postgres/create_cast-9.sql",
  "latest/postgres/create_cast-10.sql",
  "latest/postgres/create_cast-11.sql",
  "latest/postgres/create_cast-12.sql",
  "latest/postgres/create_cast-13.sql",
  "latest/postgres/create_cast-14.sql",
  "latest/postgres/create_cast-15.sql",
  "latest/postgres/create_cast-16.sql",
  "latest/postgres/create_cast-17.sql",
  "latest/postgres/create_cast-18.sql",
  "latest/postgres/create_cast-19.sql",
  "latest/postgres/create_cast-20.sql",
  "latest/postgres/create_cast-21.sql",
  "latest/postgres/create_cast-22.sql",
  "latest/postgres/create_cast-23.sql",
  "latest/postgres/create_cast-24.sql"
]);
});
