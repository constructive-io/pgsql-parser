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
    // Known failing fixtures due to pre-existing deparser issues:
    // - Schema qualification loss (pg_catalog.pg_class%rowtype[] -> pg_class%rowtype[])
    // - Tagged dollar quote reconstruction ($tag$...$tag$ not supported)
    // - Exception block handling issues
    // TODO: Fix these underlying issues and remove from allowlist
    const KNOWN_FAILING_FIXTURES = new Set([
      'plpgsql_varprops-13.sql',
      'plpgsql_trap-1.sql',
      'plpgsql_trap-2.sql',
      'plpgsql_trap-3.sql',
      'plpgsql_trap-4.sql',
      'plpgsql_trap-5.sql',
      'plpgsql_trap-6.sql',
      'plpgsql_trap-7.sql',
      'plpgsql_transaction-17.sql',
      'plpgsql_transaction-19.sql',
      'plpgsql_transaction-20.sql',
      'plpgsql_transaction-21.sql',
      'plpgsql_control-15.sql',
      'plpgsql_control-17.sql',
      'plpgsql_call-44.sql',
      'plpgsql_array-20.sql',
    ]);

    it('should round-trip ALL generated fixtures (excluding known failures)', async () => {
      // Get all fixtures without any filter - this ensures we test everything
      const entries = fixtureTestUtils.getTestEntries();
      expect(entries.length).toBeGreaterThan(0);
      
      const failures: { key: string; error: string }[] = [];
      const unexpectedPasses: string[] = [];
      
      for (const [key] of entries) {
        const isKnownFailing = KNOWN_FAILING_FIXTURES.has(key);
        try {
          await fixtureTestUtils.runSingleFixture(key);
          if (isKnownFailing) {
            unexpectedPasses.push(key);
          }
        } catch (err) {
          if (!isKnownFailing) {
            failures.push({
              key,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
      
      // Report unexpected passes (fixtures that should be removed from allowlist)
      if (unexpectedPasses.length > 0) {
        console.log(`\nUnexpected passes (remove from KNOWN_FAILING_FIXTURES):\n${unexpectedPasses.join('\n')}`);
      }
      
      // Fail if any non-allowlisted fixtures fail (regression detection)
      if (failures.length > 0) {
        const failureReport = failures
          .map(f => `  - ${f.key}: ${f.error}`)
          .join('\n');
        throw new Error(
          `${failures.length} NEW fixture failures (not in allowlist):\n${failureReport}`
        );
      }
      
      // Report coverage stats
      const testedCount = entries.length - KNOWN_FAILING_FIXTURES.size;
      console.log(`\nRound-trip tested ${testedCount} of ${entries.length} fixtures (${KNOWN_FAILING_FIXTURES.size} known failures skipped)`);
    }, 120000); // 2 minute timeout for all fixtures
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
