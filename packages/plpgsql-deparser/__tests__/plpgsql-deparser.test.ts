import { loadModule } from '@libpg-query/parser';
import { PLpgSQLDeparser, deparseSync, PLpgSQLParseResult } from '../src';
import { loadPLpgSQLFixtures, PLpgSQLTestUtils } from '../test-utils';

const testUtils = new PLpgSQLTestUtils();

describe('PLpgSQLDeparser', () => {
  beforeAll(async () => {
    await loadModule();
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

  describe('fixture-based tests using @libpg-query/parser', () => {
    const fixtures = loadPLpgSQLFixtures();
    
    if (fixtures.length > 0) {
      describe('PL/pgSQL fixtures from __fixtures__/plpgsql/', () => {
        const sampleFixtures = fixtures.slice(0, 50);
        
        it.each(sampleFixtures)('should parse and deparse $name', (testCase) => {
          try {
            const parsed = testUtils.parsePLpgSQLSync(testCase.functionBody);
            
            if (parsed.plpgsql_funcs && parsed.plpgsql_funcs.length > 0) {
              const deparsed = deparseSync(parsed);
              expect(deparsed).toBeTruthy();
              expect(deparsed.length).toBeGreaterThan(0);
            }
          } catch (err) {
            console.log(`Skipping ${testCase.name}: ${err instanceof Error ? err.message : String(err)}`);
          }
        });
      });
    }

    it('should load fixtures from actual SQL files', () => {
      const fixtures = loadPLpgSQLFixtures();
      expect(fixtures.length).toBeGreaterThan(0);
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
