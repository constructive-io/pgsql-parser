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
    // TODO: Fix these underlying issues and remove from allowlist
    // Remaining known failing fixtures:
    // - plpgsql_varprops-13.sql: nested DECLARE inside FOR loop - variables declared inside
    //   the loop body are hoisted to the top-level DECLARE section, changing semantics
    //   (variables should be reinitialized on each loop iteration)
    const KNOWN_FAILING_FIXTURES = new Set([
      'plpgsql_varprops-13.sql',
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
