import { loadModule } from '@libpg-query/parser';
import { PLpgSQLDeparser, deparseSync, PLpgSQLParseResult } from '../src';
import { FixtureTestUtils } from '../test-utils';

describe('PLpgSQLDeparser', () => {
  let fixtureTestUtils: FixtureTestUtils;

  beforeAll(async () => {
    await loadModule();
    fixtureTestUtils = new FixtureTestUtils();
  });

  describe('empty results', () => {
    it('should handle empty parse result', () => {
      const parseResult: PLpgSQLParseResult = {
        plpgsql_funcs: [],
      };

      const result = deparseSync(parseResult);
      expect(result).toBe('');
    });
  });

  describe('generated fixtures', () => {
    it('should have generated fixtures available', () => {
      expect(fixtureTestUtils.getFixtureCount()).toBeGreaterThan(0);
    });

    it('should have at least 100 valid fixtures', () => {
      expect(fixtureTestUtils.getFixtureCount()).toBeGreaterThanOrEqual(100);
    });
  });

  describe('round-trip tests using generated.json', () => {
    it('should round-trip plpgsql_domain fixtures', async () => {
      const entries = fixtureTestUtils.getTestEntries(['plpgsql_domain']);
      expect(entries.length).toBeGreaterThan(0);
      
      for (const [key] of entries) {
        await fixtureTestUtils.runSingleFixture(key);
      }
    });
  });

  describe('PLpgSQLDeparser class', () => {
    it('should create deparser with default options', () => {
      const deparser = new PLpgSQLDeparser();
      expect(deparser).toBeDefined();
    });

    it('should create deparser with custom options', () => {
      const deparser = new PLpgSQLDeparser({ uppercase: false, indent: '    ' });
      expect(deparser).toBeDefined();
    });
  });
});
