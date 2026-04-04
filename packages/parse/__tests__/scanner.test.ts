import { scanComments, ScannedElement, initWasm } from '../src/scanner';

describe('scanComments', () => {
  beforeAll(async () => {
    await initWasm();
  });
  describe('line comments', () => {
    it('extracts a simple line comment', () => {
      const sql = '-- hello world\nSELECT 1;';
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(1);
      expect(comments[0].value).toMatchObject({
        type: 'line',
        text: ' hello world',
        start: 0,
        end: 14,
      });
    });

    it('extracts multiple line comments', () => {
      const sql = '-- first\nSELECT 1;\n-- second\nSELECT 2;';
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(2);
      expect(comments[0].value.text).toBe(' first');
      expect(comments[1].value.text).toBe(' second');
    });

    it('extracts a comment at end of line after a statement', () => {
      const sql = 'SELECT 1; -- inline comment';
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(1);
      expect(comments[0].value.text).toBe(' inline comment');
    });
  });

  describe('block comments', () => {
    it('extracts a simple block comment', () => {
      const sql = '/* block */ SELECT 1;';
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(1);
      expect(comments[0].value).toMatchObject({
        type: 'block',
        text: ' block ',
        start: 0,
        end: 11,
      });
    });

    it('handles nested block comments', () => {
      const sql = '/* outer /* inner */ still outer */ SELECT 1;';
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(1);
      expect(comments[0].value.text).toBe(' outer /* inner */ still outer ');
    });

    it('handles multi-line block comments', () => {
      const sql = '/*\n  multi\n  line\n*/ SELECT 1;';
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(1);
      expect(comments[0].value.text).toContain('multi');
      expect(comments[0].value.text).toContain('line');
    });
  });

  describe('string literals (should be skipped)', () => {
    it('ignores -- inside a string literal', () => {
      const sql = "SELECT '-- not a comment';";
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(0);
    });

    it('ignores /* inside a string literal', () => {
      const sql = "SELECT '/* not a comment */';";
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(0);
    });

    it('handles escaped quotes in strings', () => {
      const sql = "SELECT 'it''s -- not a comment';";
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(0);
    });
  });

  describe('dollar-quoted strings (should be skipped)', () => {
    it('ignores comments inside $$ dollar-quoted strings', () => {
      const sql = "SELECT $$ -- not a comment $$;";
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(0);
    });

    it('ignores comments inside tagged dollar-quoted strings', () => {
      const sql = "SELECT $body$ -- not a comment $body$;";
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(0);
    });

    it('handles $$ in function bodies', () => {
      const sql = `CREATE FUNCTION foo() RETURNS void AS $$
BEGIN
  -- this is inside the function body
  RAISE NOTICE 'hello';
END;
$$ LANGUAGE plpgsql;
-- this is outside`;
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      // Only the comment outside the dollar-quoted string should be found
      expect(comments).toHaveLength(1);
      expect(comments[0].value.text).toBe(' this is outside');
    });
  });

  describe('escape strings (should be skipped)', () => {
    it('ignores comments inside E-strings', () => {
      const sql = "SELECT E'test -- not a comment\\n';";
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(0);
    });
  });

  describe('vertical whitespace', () => {
    it('detects blank lines between statements', () => {
      const sql = 'SELECT 1;\n\nSELECT 2;';
      const elements = scanComments(sql);
      const ws = elements.filter(e => e.kind === 'whitespace');
      expect(ws).toHaveLength(1);
      expect(ws[0].value.lines).toBe(1);
    });

    it('detects multiple blank lines', () => {
      const sql = 'SELECT 1;\n\n\n\nSELECT 2;';
      const elements = scanComments(sql);
      const ws = elements.filter(e => e.kind === 'whitespace');
      expect(ws).toHaveLength(1);
      expect(ws[0].value.lines).toBe(3);
    });

    it('does not detect single newlines as whitespace', () => {
      const sql = 'SELECT 1;\nSELECT 2;';
      const elements = scanComments(sql);
      const ws = elements.filter(e => e.kind === 'whitespace');
      expect(ws).toHaveLength(0);
    });
  });

  describe('mixed comments and whitespace', () => {
    it('extracts comments and whitespace in order', () => {
      const sql = '-- header\n\nSELECT 1;\n\n-- footer';
      const elements = scanComments(sql);
      // comment, whitespace after comment, whitespace after SELECT, comment
      expect(elements).toHaveLength(4);
      expect(elements[0].kind).toBe('comment');
      expect(elements[1].kind).toBe('whitespace');
      expect(elements[2].kind).toBe('whitespace');
      expect(elements[3].kind).toBe('comment');
    });

    it('handles PGPM header pattern', () => {
      const sql = `-- Deploy schemas/my-schema/tables/users to pg
-- requires: schemas/my-schema/schema

BEGIN;

CREATE TABLE my_schema.users (
  id serial PRIMARY KEY
);

COMMIT;`;
      const elements = scanComments(sql);
      const comments = elements.filter(e => e.kind === 'comment');
      expect(comments).toHaveLength(2);
      expect(comments[0].value.text).toContain('Deploy');
      expect(comments[1].value.text).toContain('requires');
    });
  });
});
