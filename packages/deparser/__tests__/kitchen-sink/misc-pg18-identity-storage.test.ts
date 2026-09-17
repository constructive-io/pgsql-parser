
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-pg18-identity-storage', async () => {
  await fixtures.runFixtureTests([
  "misc/pg18-identity-storage-1.sql",
  "misc/pg18-identity-storage-2.sql",
  "misc/pg18-identity-storage-3.sql",
  "misc/pg18-identity-storage-4.sql",
  "misc/pg18-identity-storage-5.sql",
  "misc/pg18-identity-storage-6.sql",
  "misc/pg18-identity-storage-7.sql",
  "misc/pg18-identity-storage-8.sql",
  "misc/pg18-identity-storage-9.sql",
  "misc/pg18-identity-storage-10.sql",
  "misc/pg18-identity-storage-11.sql",
  "misc/pg18-identity-storage-12.sql",
  "misc/pg18-identity-storage-13.sql",
  "misc/pg18-identity-storage-14.sql",
  "misc/pg18-identity-storage-15.sql",
  "misc/pg18-identity-storage-16.sql",
  "misc/pg18-identity-storage-17.sql",
  "misc/pg18-identity-storage-18.sql",
  "misc/pg18-identity-storage-19.sql"
]);
});
