import { deparse, deparseSync, loadModule,parse, parseSync } from '../src';

describe('pgsql-parser', () => {
  describe('Async API', () => {
    it('should parse a simple SELECT statement', async () => {
      const sql = 'SELECT * FROM test_table';
      const parseResult = await parse(sql);

      expect(parseResult).toBeDefined();
      expect(parseResult.stmts).toBeDefined();
      expect(Array.isArray(parseResult.stmts)).toBe(true);
      expect(parseResult.stmts!.length).toBeGreaterThan(0);
      expect(parseResult.stmts![0]).toHaveProperty('stmt');
    });

    it('should deparse an AST back to SQL', async () => {
      const sql = 'SELECT * FROM test_table';
      const parseResult = await parse(sql);
      const deparsed = await deparse(parseResult);

      expect(deparsed).toBeDefined();
      expect(typeof deparsed).toBe('string');
      expect(deparsed.toLowerCase()).toContain('select');
      expect(deparsed.toLowerCase()).toContain('test_table');
    });

    it('should support AST manipulation and round-trip', async () => {
      const sql = 'SELECT * FROM test_table';
      const parseResult = await parse(sql);

      // Manipulate the AST to change the table name
      const stmt = parseResult.stmts![0].stmt as any;
      stmt.SelectStmt.fromClause[0].RangeVar.relname = 'another_table';

      const deparsed = await deparse(parseResult);

      expect(deparsed.toLowerCase()).toContain('another_table');
      expect(deparsed.toLowerCase()).not.toContain('test_table');
    });

    it('should parse and deparse more complex queries', async () => {
      const sql = 'SELECT id, name FROM users WHERE age > 18 ORDER BY name';
      const parseResult = await parse(sql);
      const deparsed = await deparse(parseResult);

      expect(deparsed).toBeDefined();
      expect(deparsed.toLowerCase()).toContain('select');
      expect(deparsed.toLowerCase()).toContain('users');
      expect(deparsed.toLowerCase()).toContain('where');
    });
  });

  describe('Sync API', () => {
    beforeAll(async () => {
      // Initialize module for sync methods
      await loadModule();
    });

    it('should parse a simple SELECT statement synchronously', () => {
      const sql = 'SELECT * FROM test_table';
      const parseResult = parseSync(sql);

      expect(parseResult).toBeDefined();
      expect(parseResult.stmts).toBeDefined();
      expect(Array.isArray(parseResult.stmts)).toBe(true);
      expect(parseResult.stmts!.length).toBeGreaterThan(0);
      expect(parseResult.stmts![0]).toHaveProperty('stmt');
    });

    it('should deparse an AST back to SQL synchronously', () => {
      const sql = 'SELECT * FROM test_table';
      const parseResult = parseSync(sql);
      const deparsed = deparseSync(parseResult);

      expect(deparsed).toBeDefined();
      expect(typeof deparsed).toBe('string');
      expect(deparsed.toLowerCase()).toContain('select');
      expect(deparsed.toLowerCase()).toContain('test_table');
    });

    it('should support AST manipulation with sync methods', () => {
      const sql = 'SELECT * FROM test_table';
      const parseResult = parseSync(sql);

      // Manipulate the AST to change the table name
      const stmt = parseResult.stmts![0].stmt as any;
      stmt.SelectStmt.fromClause[0].RangeVar.relname = 'modified_table';

      const deparsed = deparseSync(parseResult);

      expect(deparsed.toLowerCase()).toContain('modified_table');
      expect(deparsed.toLowerCase()).not.toContain('test_table');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid SQL gracefully', async () => {
      const invalidSql = 'SELECT * FROM';

      await expect(parse(invalidSql)).rejects.toThrow();
    });

    it('should handle invalid SQL gracefully with sync methods', async () => {
      await loadModule();
      const invalidSql = 'SELECT * FROM';

      expect(() => parseSync(invalidSql)).toThrow();
    });
  });
});
