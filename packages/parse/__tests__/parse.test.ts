import { parse, parseSync, deparseEnhanced, isRawComment, isRawWhitespace, isRawStmt, loadModule } from '../src';

beforeAll(async () => {
  await loadModule();
});

describe('parse (enhanced)', () => {
  describe('parseSync', () => {
    it('parses simple SQL without comments', () => {
      const result = parseSync('SELECT 1;');
      expect(result.version).toBeDefined();
      const stmts = result.stmts.filter(isRawStmt);
      expect(stmts).toHaveLength(1);
    });

    it('preserves line comments before statements', () => {
      const sql = '-- this is a comment\nSELECT 1;';
      const result = parseSync(sql);
      const comments = result.stmts.filter(isRawComment);
      expect(comments).toHaveLength(1);
      expect(comments[0].RawComment.type).toBe('line');
      expect(comments[0].RawComment.text).toBe(' this is a comment');
    });

    it('preserves block comments before statements', () => {
      const sql = '/* block comment */\nSELECT 1;';
      const result = parseSync(sql);
      const comments = result.stmts.filter(isRawComment);
      expect(comments).toHaveLength(1);
      expect(comments[0].RawComment.type).toBe('block');
      expect(comments[0].RawComment.text).toBe(' block comment ');
    });

    it('preserves vertical whitespace between statements', () => {
      const sql = 'SELECT 1;\n\n\nSELECT 2;';
      const result = parseSync(sql);
      const ws = result.stmts.filter(isRawWhitespace);
      expect(ws).toHaveLength(1);
      expect(ws[0].RawWhitespace.lines).toBeGreaterThanOrEqual(1);
    });

    it('interleaves comments in correct position', () => {
      const sql = '-- header\nSELECT 1;\n-- middle\nSELECT 2;\n-- footer';
      const result = parseSync(sql);
      
      expect(result.stmts.length).toBeGreaterThanOrEqual(5);
      expect(isRawComment(result.stmts[0])).toBe(true);
      expect(isRawStmt(result.stmts[1])).toBe(true);
      expect(isRawComment(result.stmts[2])).toBe(true);
      expect(isRawStmt(result.stmts[3])).toBe(true);
      expect(isRawComment(result.stmts[4])).toBe(true);
    });

    it('handles PGPM header comments', () => {
      const sql = `-- Deploy schemas/my-schema/tables/users to pg
-- requires: schemas/my-schema/schema

BEGIN;

CREATE TABLE my_schema.users (
  id serial PRIMARY KEY,
  name text NOT NULL
);

COMMIT;`;
      const result = parseSync(sql);
      const comments = result.stmts.filter(isRawComment);
      expect(comments.length).toBeGreaterThanOrEqual(2);
      expect(comments[0].RawComment.text).toContain('Deploy');
      expect(comments[1].RawComment.text).toContain('requires');
    });

    it('handles nested block comments', () => {
      const sql = '/* outer /* inner */ still outer */ SELECT 1;';
      const result = parseSync(sql);
      const comments = result.stmts.filter(isRawComment);
      expect(comments).toHaveLength(1);
      expect(comments[0].RawComment.text).toContain('inner');
    });

    it('does not pick up comments inside string literals', () => {
      const sql = "SELECT '-- not a comment';";
      const result = parseSync(sql);
      const comments = result.stmts.filter(isRawComment);
      expect(comments).toHaveLength(0);
    });

    it('does not pick up comments inside dollar-quoted strings', () => {
      const sql = `CREATE FUNCTION foo() RETURNS void AS $$
BEGIN
  -- inside function body
  RAISE NOTICE 'hello';
END;
$$ LANGUAGE plpgsql;`;
      const result = parseSync(sql);
      const comments = result.stmts.filter(isRawComment);
      // Comment inside $$ should NOT be extracted
      expect(comments).toHaveLength(0);
    });
  });

  describe('parse (async)', () => {
    it('parses with comments preserved', async () => {
      const sql = '-- async test\nSELECT 1;';
      const result = await parse(sql);
      const comments = result.stmts.filter(isRawComment);
      expect(comments).toHaveLength(1);
      expect(comments[0].RawComment.text).toBe(' async test');
    });
  });
});

describe('deparseEnhanced', () => {
  it('deparses a simple statement', () => {
    const result = parseSync('SELECT 1;');
    const sql = deparseEnhanced(result);
    expect(sql).toContain('SELECT 1');
  });

  it('deparses with line comments preserved', () => {
    const sql = '-- my comment\nSELECT 1;';
    const result = parseSync(sql);
    const output = deparseEnhanced(result);
    expect(output).toContain('-- my comment');
    expect(output).toContain('SELECT 1');
  });

  it('deparses with block comments preserved', () => {
    const sql = '/* block */ SELECT 1;';
    const result = parseSync(sql);
    const output = deparseEnhanced(result);
    expect(output).toContain('/* block */');
    expect(output).toContain('SELECT 1');
  });

  it('round-trips comments through parse→deparse', () => {
    const sql = `-- header comment
SELECT 1;

-- section break
SELECT 2;`;
    const result = parseSync(sql);
    const output = deparseEnhanced(result);
    expect(output).toContain('-- header comment');
    expect(output).toContain('-- section break');
    expect(output).toContain('SELECT 1');
    expect(output).toContain('SELECT 2');
  });

  it('round-trips block comments through parse→deparse', () => {
    const sql = `/* header */
SELECT 1;

/* footer */
SELECT 2;`;
    const result = parseSync(sql);
    const output = deparseEnhanced(result);
    expect(output).toContain('/* header */');
    expect(output).toContain('/* footer */');
  });

  it('preserves multiple comment types', () => {
    const sql = `-- line comment
/* block comment */
SELECT 1;`;
    const result = parseSync(sql);
    const output = deparseEnhanced(result);
    expect(output).toContain('-- line comment');
    expect(output).toContain('/* block comment */');
  });

  it('idempotent: parse→deparse→parse→deparse produces same output', () => {
    const sql = `-- Deploy schemas/test/tables/foo to pg
-- requires: schemas/test/schema

BEGIN;

CREATE TABLE test.foo (
  id serial PRIMARY KEY
);

COMMIT;`;
    const result1 = parseSync(sql);
    const output1 = deparseEnhanced(result1);
    const result2 = parseSync(output1);
    const output2 = deparseEnhanced(result2);
    expect(output2).toBe(output1);
  });
});

describe('kitchen sink', () => {
  it('handles a complex SQL file with all comment types', () => {
    const sql = `-- Deploy schemas/my-app/tables/users to pg
-- requires: schemas/my-app/schema

/* 
 * This file creates the users table
 * with all required columns.
 */

BEGIN;

-- Create the main users table
CREATE TABLE my_app.users (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE
);

/* Add an index for lookups */
CREATE INDEX idx_users_email ON my_app.users (email);

-- Grant permissions
GRANT SELECT ON my_app.users TO app_reader;

COMMIT;`;

    const result = parseSync(sql);
    const output = deparseEnhanced(result);
    
    // All comments should survive
    expect(output).toContain('-- Deploy schemas/my-app/tables/users to pg');
    expect(output).toContain('-- requires: schemas/my-app/schema');
    expect(output).toContain('This file creates the users table');
    expect(output).toContain('-- Create the main users table');
    expect(output).toContain('/* Add an index for lookups */');
    expect(output).toContain('-- Grant permissions');

    // All statements should survive
    expect(output).toContain('BEGIN');
    expect(output).toContain('CREATE TABLE');
    expect(output).toContain('CREATE INDEX');
    expect(output).toContain('GRANT');
    expect(output).toContain('COMMIT');
  });
});
