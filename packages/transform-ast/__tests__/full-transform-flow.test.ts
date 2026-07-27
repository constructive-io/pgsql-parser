import { FullTransformFlowFixture } from '../test-utils/full-transform-flow';
import { skipTests } from '../test-utils/skip-tests';

const testFiles = [
  'original/upstream/plpgsql-86.sql',
  'original/upstream/plpgsql-202.sql',
  'original/upstream/plpgsql-203.sql',
  'original/upstream/plpgsql-204.sql',
  'original/upstream/plpgsql-205.sql',
  'original/upstream/plpgsql-206.sql',
  'original/upstream/plpgsql-207.sql',
  'original/upstream/plpgsql-208.sql',
  'original/upstream/plpgsql-209.sql',
  'original/upstream/plpgsql-210.sql',
  'original/upstream/plpgsql-211.sql',
  'original/upstream/plpgsql-212.sql',
  'original/upstream/plpgsql-213.sql',
  'original/upstream/plpgsql-214.sql',
  'original/upstream/plpgsql-215.sql',
  'original/upstream/plpgsql-216.sql',
  'original/upstream/plpgsql-217.sql',
  'original/upstream/plpgsql-218.sql',
  'original/upstream/plpgsql-219.sql',
  'original/upstream/plpgsql-220.sql',
  'original/upstream/plpgsql-221.sql',
  'original/upstream/plpgsql-222.sql',
  'original/upstream/plpgsql-223.sql',
  "pretty/misc-1.sql",
  "pretty/misc-2.sql",
  "pretty/misc-3.sql",
  "pretty/misc-4.sql",
  // "pretty/misc-5.sql",
  "pretty/misc-6.sql",
  "pretty/misc-7.sql",
  "pretty/misc-8.sql",
  "pretty/misc-9.sql",
  "pretty/misc-10.sql",
  "pretty/misc-11.sql",
  "pretty/misc-12.sql",
  "pretty/misc-13.sql",
  "pretty/create_table-1.sql",
  "pretty/create_table-2.sql",
  "pretty/create_table-3.sql",
  "pretty/create_table-4.sql",
  "pretty/create_table-5.sql",
  "pretty/create_policy-1.sql",
  "pretty/create_policy-2.sql",
  "pretty/create_policy-3.sql",
  "pretty/create_policy-4.sql",
  "pretty/constraints-1.sql",
  "pretty/constraints-2.sql",
  "pretty/constraints-4.sql",
].filter(filename => !skipTests.some(([from, to, f]) => filename === f));

describe('Full Transform Flow Tests', () => {
  const fixture = new FullTransformFlowFixture();

  testFiles.forEach((filename) => {
    it(`tests end-to-end flow for ${filename}`, async () => {
      await fixture.runTransformFlowTest(filename);
    });
  });
});
