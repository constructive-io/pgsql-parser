import { loadModule } from '@libpg-query/parser';
import { parseSync } from '../src/parse';
import { deparseSync } from '../src/deparse';
import { readFileSync, readdirSync } from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

beforeAll(async () => {
  await loadModule();
});

describe('round-trip: parse → deparse', () => {
  it('should preserve body comments through round trip', () => {
    const sql = `CREATE FUNCTION get_one() RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  -- Return one
  RETURN 1;
END;
$$;`;
    const parsed = parseSync(sql);
    const deparsed = deparseSync(parsed);
    expect(deparsed).toContain('-- Return one');
  });

  it('should preserve multiple body comments', () => {
    const sql = `CREATE FUNCTION test_fn() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- First comment
  PERFORM do_something();
  -- Second comment
  RETURN;
END;
$$;`;
    const parsed = parseSync(sql);
    const deparsed = deparseSync(parsed);
    expect(deparsed).toContain('-- First comment');
    expect(deparsed).toContain('-- Second comment');
  });

  it('should preserve outer SQL comments', () => {
    const sql = `-- Outer comment before function
CREATE FUNCTION get_one() RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 1;
END;
$$;`;
    const parsed = parseSync(sql);
    const deparsed = deparseSync(parsed);
    expect(deparsed).toContain('-- Outer comment before function');
  });

  it('should preserve both outer and body comments', () => {
    const sql = `-- Outer comment
CREATE FUNCTION get_one() RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  -- Body comment
  RETURN 1;
END;
$$;`;
    const parsed = parseSync(sql);
    const deparsed = deparseSync(parsed);
    expect(deparsed).toContain('-- Outer comment');
    expect(deparsed).toContain('-- Body comment');
  });

  it('should handle functions without body comments', () => {
    const sql = `CREATE FUNCTION get_one() RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 1;
END;
$$;`;
    const parsed = parseSync(sql);
    const deparsed = deparseSync(parsed);
    expect(deparsed).toContain('RETURN');
    // Should not contain any comments
    expect(deparsed).not.toContain('--');
  });

  it('should be idempotent (parse→deparse→parse→deparse)', () => {
    const sql = `CREATE FUNCTION test_fn() RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  -- A comment
  RETURN 1;
END;
$$;`;
    const parsed1 = parseSync(sql);
    const deparsed1 = deparseSync(parsed1);

    const parsed2 = parseSync(deparsed1);
    const deparsed2 = deparseSync(parsed2);

    expect(deparsed2).toBe(deparsed1);
  });

  it('should preserve trigger function body comments', () => {
    const sql = `CREATE FUNCTION my_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set timestamp
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;`;
    const parsed = parseSync(sql);
    const deparsed = deparseSync(parsed);
    expect(deparsed).toContain('-- Set timestamp');
  });

  it('should handle consecutive comment lines', () => {
    const sql = `CREATE FUNCTION test_fn() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Line one of comment
  -- Line two of comment
  RETURN;
END;
$$;`;
    const parsed = parseSync(sql);
    const deparsed = deparseSync(parsed);
    expect(deparsed).toContain('-- Line one of comment');
    expect(deparsed).toContain('-- Line two of comment');
  });
});

describe('fixture round-trip tests', () => {
  const fixtureFiles = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.sql'));

  for (const file of fixtureFiles) {
    describe(file, () => {
      const sql = readFileSync(path.join(FIXTURES_DIR, file), 'utf-8');

      it('should parse without errors', () => {
        const result = parseSync(sql);
        expect(result.enhanced).toBeDefined();
        expect(result.enhanced.stmts.length).toBeGreaterThan(0);
      });

      it('should deparse without errors', () => {
        const parsed = parseSync(sql);
        const deparsed = deparseSync(parsed);
        expect(deparsed).toBeTruthy();
      });

      it('deparsed output matches snapshot', () => {
        const parsed = parseSync(sql);
        const deparsed = deparseSync(parsed);
        expect(deparsed).toMatchSnapshot();
      });

      it('should be idempotent (second round trip matches first)', () => {
        const parsed1 = parseSync(sql);
        const deparsed1 = deparseSync(parsed1);

        const parsed2 = parseSync(deparsed1);
        const deparsed2 = deparseSync(parsed2);

        expect(deparsed2).toBe(deparsed1);
      });
    });
  }
});
