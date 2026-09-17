
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('misc-pg18-window-frames', async () => {
  await fixtures.runFixtureTests([
  "misc/pg18-window-frames-1.sql",
  "misc/pg18-window-frames-2.sql",
  "misc/pg18-window-frames-3.sql",
  "misc/pg18-window-frames-4.sql",
  "misc/pg18-window-frames-5.sql",
  "misc/pg18-window-frames-6.sql",
  "misc/pg18-window-frames-7.sql",
  "misc/pg18-window-frames-8.sql",
  "misc/pg18-window-frames-9.sql",
  "misc/pg18-window-frames-10.sql",
  "misc/pg18-window-frames-11.sql",
  "misc/pg18-window-frames-12.sql",
  "misc/pg18-window-frames-13.sql",
  "misc/pg18-window-frames-14.sql",
  "misc/pg18-window-frames-15.sql",
  "misc/pg18-window-frames-16.sql",
  "misc/pg18-window-frames-17.sql",
  "misc/pg18-window-frames-18.sql",
  "misc/pg18-window-frames-19.sql",
  "misc/pg18-window-frames-20.sql",
  "misc/pg18-window-frames-21.sql"
]);
});
