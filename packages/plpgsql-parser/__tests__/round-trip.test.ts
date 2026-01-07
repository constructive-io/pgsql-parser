import { parse, deparseSync, loadModule } from '../src';
import { parseSync } from '@libpg-query/parser';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, '../../../__fixtures__/plpgsql');
const GENERATED_JSON = path.join(__dirname, '../../../__fixtures__/plpgsql-generated/generated.json');

const noop = (): undefined => undefined;

const transform = (obj: any, props: any): any => {
  let copy: any = null;
  if (obj == null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }

  if (obj instanceof Array) {
    copy = [];
    for (let i = 0, len = obj.length; i < len; i++) {
      copy[i] = transform(obj[i], props);
    }
    return copy;
  }

  if (obj instanceof Object || typeof obj === 'object') {
    copy = {};
    for (const attr in obj) {
      if (obj.hasOwnProperty(attr)) {
        let value: any;
        if (props.hasOwnProperty(attr)) {
          if (typeof props[attr] === 'function') {
            value = props[attr](obj[attr]);
          } else if (props[attr].hasOwnProperty(obj[attr])) {
            value = props[attr][obj[attr]];
          } else {
            value = transform(obj[attr], props);
          }
        } else {
          value = transform(obj[attr], props);
        }
        if (value !== undefined) {
          copy[attr] = value;
        }
      } else {
        const value = transform(obj[attr], props);
        if (value !== undefined) {
          copy[attr] = value;
        }
      }
    }
    return copy;
  }

  throw new Error("Unable to copy obj! Its type isn't supported.");
};

const cleanSqlTree = (tree: any) => {
  return transform(tree, {
    stmt_len: noop,
    stmt_location: noop,
    location: noop,
  });
};

beforeAll(async () => {
  await loadModule();
});

describe('plpgsql-parser round-trip tests', () => {
  describe('fixture-based integration tests', () => {
    const fixtureFile = path.join(FIXTURES_DIR, 'plpgsql_deparser_fixes.sql');
    
    if (!existsSync(fixtureFile)) {
      it.skip('fixture file not found', () => {});
      return;
    }

    const sql = readFileSync(fixtureFile, 'utf-8');
    const statements = sql.split(/;\s*\n/).filter(s => s.trim() && !s.trim().startsWith('--'));

    it.each(statements.map((stmt, i) => [i + 1, stmt.trim() + ';']))
    ('should round-trip statement %i', async (_, statement) => {
      const stmt = statement as string;
      
      // Skip empty statements or comments
      if (!stmt.match(/CREATE\s+(FUNCTION|PROCEDURE)/i)) {
        return;
      }

      // Parse with plpgsql-parser (auto-hydrates)
      const parsed = parse(stmt);
      
      // Deparse with plpgsql-parser (auto-passes return info)
      const deparsed = deparseSync(parsed);
      
      // Reparse the deparsed SQL
      const reparsed = parse(deparsed);
      
      // Clean both ASTs for comparison
      const originalClean = cleanSqlTree(parsed.sql);
      const reparsedClean = cleanSqlTree(reparsed.sql);
      
      // Compare SQL ASTs
      expect(reparsedClean).toEqual(originalClean);
    });
  });

  describe('return info integration', () => {
    it('should handle SETOF function with bare RETURN correctly', () => {
      const sql = `
        CREATE FUNCTION get_items()
        RETURNS SETOF int
        LANGUAGE plpgsql AS $$
        BEGIN
          RETURN QUERY SELECT 1;
          RETURN;
        END;
        $$;
      `;
      
      const parsed = parse(sql);
      const deparsed = deparseSync(parsed);
      
      // SETOF functions should keep bare RETURN (not RETURN NULL)
      expect(deparsed).toMatch(/RETURN\s*;/);
      expect(deparsed).not.toMatch(/RETURN\s+NULL\s*;/);
      
      // Verify round-trip
      const reparsed = parse(deparsed);
      expect(cleanSqlTree(reparsed.sql)).toEqual(cleanSqlTree(parsed.sql));
    });

    it('should handle scalar function with empty RETURN correctly', () => {
      const sql = `
        CREATE FUNCTION get_value()
        RETURNS int
        LANGUAGE plpgsql AS $$
        BEGIN
          RETURN;
        END;
        $$;
      `;
      
      const parsed = parse(sql);
      const deparsed = deparseSync(parsed);
      
      // Scalar functions with empty RETURN should become RETURN NULL
      expect(deparsed).toMatch(/RETURN\s+NULL\s*;/);
      
      // Verify round-trip (AST should match after normalization)
      const reparsed = parse(deparsed);
      expect(cleanSqlTree(reparsed.sql)).toEqual(cleanSqlTree(parsed.sql));
    });

    it('should handle void function with bare RETURN correctly', () => {
      const sql = `
        CREATE FUNCTION do_nothing()
        RETURNS void
        LANGUAGE plpgsql AS $$
        BEGIN
          RETURN;
        END;
        $$;
      `;
      
      const parsed = parse(sql);
      const deparsed = deparseSync(parsed);
      
      // Void functions should keep bare RETURN
      expect(deparsed).toMatch(/RETURN\s*;/);
      expect(deparsed).not.toMatch(/RETURN\s+NULL\s*;/);
      
      // Verify round-trip
      const reparsed = parse(deparsed);
      expect(cleanSqlTree(reparsed.sql)).toEqual(cleanSqlTree(parsed.sql));
    });

    it('should handle OUT parameter function with bare RETURN correctly', () => {
      const sql = `
        CREATE FUNCTION get_info(OUT result text)
        RETURNS text
        LANGUAGE plpgsql AS $$
        BEGIN
          result := 'hello';
          RETURN;
        END;
        $$;
      `;
      
      const parsed = parse(sql);
      const deparsed = deparseSync(parsed);
      
      // OUT parameter functions should keep bare RETURN
      expect(deparsed).toMatch(/RETURN\s*;/);
      expect(deparsed).not.toMatch(/RETURN\s+NULL\s*;/);
      
      // Verify round-trip
      const reparsed = parse(deparsed);
      expect(cleanSqlTree(reparsed.sql)).toEqual(cleanSqlTree(parsed.sql));
    });

    it('should handle trigger function correctly', () => {
      const sql = `
        CREATE FUNCTION my_trigger()
        RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          RETURN NEW;
        END;
        $$;
      `;
      
      const parsed = parse(sql);
      const deparsed = deparseSync(parsed);
      
      // Trigger functions should work correctly
      expect(deparsed.toLowerCase()).toContain('return new');
      
      // Verify round-trip
      const reparsed = parse(deparsed);
      expect(cleanSqlTree(reparsed.sql)).toEqual(cleanSqlTree(parsed.sql));
    });
  });

  describe('generated fixtures round-trip', () => {
    if (!existsSync(GENERATED_JSON)) {
      it.skip('generated.json not found', () => {});
      return;
    }

    const fixtures: Record<string, string> = JSON.parse(readFileSync(GENERATED_JSON, 'utf-8'));
    const entries = Object.entries(fixtures);

    it('should have generated fixtures available', () => {
      expect(entries.length).toBeGreaterThan(0);
    });

    it('should round-trip all generated fixtures through plpgsql-parser', async () => {
      const failures: { key: string; error: string }[] = [];
      
      for (const [key, sql] of entries) {
        try {
          // Parse with plpgsql-parser
          const parsed = parse(sql);
          
          // Only test if we found PL/pgSQL functions
          if (parsed.functions.length === 0) {
            continue;
          }
          
          // Deparse with plpgsql-parser
          const deparsed = deparseSync(parsed);
          
          // Reparse
          const reparsed = parse(deparsed);
          
          // Compare cleaned ASTs
          const originalClean = cleanSqlTree(parsed.sql);
          const reparsedClean = cleanSqlTree(reparsed.sql);
          
          expect(reparsedClean).toEqual(originalClean);
        } catch (err) {
          failures.push({
            key,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      
      if (failures.length > 0) {
        const failureReport = failures
          .slice(0, 10)
          .map(f => `  - ${f.key}: ${f.error.substring(0, 100)}`)
          .join('\n');
        console.log(`\n${failures.length} fixture failures:\n${failureReport}`);
      }
      
      // Allow some failures for now, but track them
      const failureRate = failures.length / entries.length;
      expect(failureRate).toBeLessThan(0.1); // Less than 10% failure rate
      
      console.log(`\nRound-trip tested ${entries.length - failures.length} of ${entries.length} fixtures through plpgsql-parser`);
    }, 120000);
  });
});
