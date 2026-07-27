
import { FixtureTestUtils } from '../../../test-utils';
const fixtures = new FixtureTestUtils(15, 16);

it('original-upstream-char', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/char-1.sql",
  "original/upstream/char-2.sql",
  "original/upstream/char-3.sql",
  "original/upstream/char-4.sql",
  "original/upstream/char-5.sql",
  "original/upstream/char-6.sql",
  "original/upstream/char-7.sql",
  "original/upstream/char-8.sql",
  "original/upstream/char-9.sql",
  "original/upstream/char-10.sql",
  "original/upstream/char-11.sql",
  "original/upstream/char-12.sql",
  "original/upstream/char-13.sql",
  "original/upstream/char-14.sql",
  "original/upstream/char-15.sql",
  "original/upstream/char-16.sql",
  "original/upstream/char-17.sql",
  "original/upstream/char-18.sql",
  "original/upstream/char-19.sql",
  "original/upstream/char-20.sql",
  "original/upstream/char-21.sql",
  "original/upstream/char-22.sql",
  "original/upstream/char-23.sql",
  "original/upstream/char-24.sql",
  "original/upstream/char-25.sql"
]);
});
