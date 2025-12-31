import { parse, transformSync, deparseSync, loadModule } from '../src';

beforeAll(async () => {
  await loadModule();
});

const simpleFunctionSql = `
CREATE OR REPLACE FUNCTION test_func(p_id int)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  v_count := 0;
  RAISE NOTICE 'Count: %', v_count;
END;
$$;
`;

const multiStatementSql = `
CREATE TABLE users (id int);

CREATE OR REPLACE FUNCTION get_user(p_id int)
RETURNS int
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN p_id;
END;
$$;

CREATE INDEX idx_users_id ON users(id);
`;

describe('plpgsql-parser', () => {
  describe('parse', () => {
    it('should parse a simple PL/pgSQL function', () => {
      const result = parse(simpleFunctionSql);
      
      expect(result.sql).toBeDefined();
      expect(result.sql.stmts).toHaveLength(1);
      expect(result.items).toHaveLength(1);
      expect(result.functions).toHaveLength(1);
      
      const fn = result.functions[0];
      expect(fn.kind).toBe('plpgsql-function');
      expect(fn.language).toBe('plpgsql');
      expect(fn.body.raw).toContain('v_count');
      expect(fn.plpgsql.hydrated).toBeDefined();
      expect(fn.plpgsql.stats.totalExpressions).toBeGreaterThan(0);
    });

    it('should parse multi-statement SQL with mixed content', () => {
      const result = parse(multiStatementSql);
      
      expect(result.sql.stmts).toHaveLength(3);
      expect(result.items).toHaveLength(3);
      expect(result.functions).toHaveLength(1);
      
      expect(result.items[0].kind).toBe('stmt');
      expect(result.items[1].kind).toBe('plpgsql-function');
      expect(result.items[2].kind).toBe('stmt');
    });

    it('should skip hydration when hydrate=false', () => {
      const result = parse(simpleFunctionSql, { hydrate: false });
      
      expect(result.functions).toHaveLength(0);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].kind).toBe('stmt');
    });
  });

  describe('transformSync', () => {
    it('should transform function using callback', () => {
      const result = transformSync(simpleFunctionSql, (ctx) => {
        const fn = ctx.functions[0];
        fn.stmt.funcname[0].String.sval = 'renamed_func';
      });
      
      expect(result).toContain('renamed_func');
    });

    it('should transform function using visitor', () => {
      const result = transformSync(simpleFunctionSql, {
        onFunction: (fn) => {
          fn.stmt.funcname[0].String.sval = 'visitor_renamed';
        }
      });
      
      expect(result).toContain('visitor_renamed');
    });
  });

  describe('deparseSync', () => {
    it('should deparse parsed script back to SQL', () => {
      const parsed = parse(simpleFunctionSql);
      const result = deparseSync(parsed);
      
      expect(result).toContain('CREATE');
      expect(result).toContain('FUNCTION');
      expect(result).toContain('test_func');
      expect(result).toContain('plpgsql');
    });

    it('should support pretty printing', () => {
      const parsed = parse(simpleFunctionSql);
      const result = deparseSync(parsed, { pretty: true });
      
      expect(result).toContain('\n');
    });
  });
});
