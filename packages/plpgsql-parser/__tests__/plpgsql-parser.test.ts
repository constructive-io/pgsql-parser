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

  describe('automatic return info handling', () => {
    it('should preserve bare RETURN for SETOF functions', () => {
      const setofSql = `
        CREATE FUNCTION get_users()
        RETURNS SETOF users
        LANGUAGE plpgsql AS $$
        BEGIN
          RETURN QUERY SELECT * FROM users;
          RETURN;
        END;
        $$;
      `;
      
      const parsed = parse(setofSql);
      const result = deparseSync(parsed);
      
      // SETOF functions should keep bare RETURN (not RETURN NULL)
      expect(result).toMatch(/RETURN\s*;/);
      expect(result).not.toMatch(/RETURN\s+NULL\s*;/);
    });

    it('should emit RETURN NULL for scalar functions with empty return', () => {
      const scalarSql = `
        CREATE FUNCTION get_value()
        RETURNS int
        LANGUAGE plpgsql AS $$
        BEGIN
          RETURN;
        END;
        $$;
      `;
      
      const parsed = parse(scalarSql);
      const result = deparseSync(parsed);
      
      // Scalar functions with empty RETURN should become RETURN NULL
      expect(result).toMatch(/RETURN\s+NULL\s*;/);
    });

    it('should preserve bare RETURN for void functions', () => {
      const voidSql = `
        CREATE FUNCTION do_something()
        RETURNS void
        LANGUAGE plpgsql AS $$
        BEGIN
          RAISE NOTICE 'done';
          RETURN;
        END;
        $$;
      `;
      
      const parsed = parse(voidSql);
      const result = deparseSync(parsed);
      
      // Void functions should keep bare RETURN
      expect(result).toMatch(/RETURN\s*;/);
      expect(result).not.toMatch(/RETURN\s+NULL\s*;/);
    });

    it('should preserve bare RETURN for trigger functions', () => {
      const triggerSql = `
        CREATE FUNCTION my_trigger()
        RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          RETURN NEW;
        END;
        $$;
      `;
      
      const parsed = parse(triggerSql);
      const result = deparseSync(parsed);
      
      // Trigger functions should work correctly (case-insensitive check)
      expect(result.toLowerCase()).toContain('return new');
    });

    it('should preserve bare RETURN for OUT parameter functions', () => {
      const outParamSql = `
        CREATE FUNCTION get_info(OUT result text)
        RETURNS text
        LANGUAGE plpgsql AS $$
        BEGIN
          result := 'hello';
          RETURN;
        END;
        $$;
      `;
      
      const parsed = parse(outParamSql);
      const result = deparseSync(parsed);
      
      // OUT parameter functions should keep bare RETURN
      expect(result).toMatch(/RETURN\s*;/);
      expect(result).not.toMatch(/RETURN\s+NULL\s*;/);
    });
  });

  describe('SELECT INTO statement parsing', () => {
    // This test documents a bug in @libpg-query/parser where PL/pgSQL functions
    // containing SELECT INTO statements fail to parse, causing the function
    // to not be recognized as a PL/pgSQL function and preventing hydration.
    // 
    // Bug: parsePlPgSQLSync throws "Unexpected non-whitespace character after JSON"
    // when the function body contains SELECT INTO statements.
    //
    // This causes inconsistent behavior:
    // - Functions with DELETE/INSERT/UPDATE: parse successfully, get hydrated
    // - Functions with SELECT INTO: fail to parse, not recognized as PL/pgSQL
    //
    // Related issue: https://github.com/pganalyze/libpg_query/issues/XXX

    it('should parse function with SELECT INTO statement', () => {
      const selectIntoSql = `
        CREATE FUNCTION get_data()
        RETURNS void
        LANGUAGE plpgsql AS $$
        DECLARE
          v_result text;
        BEGIN
          SELECT * INTO v_result FROM some_table WHERE id = 1;
        END;
        $$;
      `;
      
      const parsed = parse(selectIntoSql);
      
      // This currently fails because @libpg-query/parser cannot parse
      // PL/pgSQL functions with SELECT INTO statements
      expect(parsed.functions).toHaveLength(1);
      expect(parsed.functions[0].kind).toBe('plpgsql-function');
      expect(parsed.functions[0].plpgsql.hydrated).toBeDefined();
    });

    it('should parse function with SELECT INTO and schema-qualified table', () => {
      const selectIntoSchemaSql = `
        CREATE FUNCTION "my_schema".get_data()
        RETURNS void
        LANGUAGE plpgsql AS $$
        DECLARE
          v_result text;
        BEGIN
          SELECT * INTO v_result FROM "my_schema".some_table WHERE id = 1;
        END;
        $$;
      `;
      
      const parsed = parse(selectIntoSchemaSql);
      
      // This currently fails because @libpg-query/parser cannot parse
      // PL/pgSQL functions with SELECT INTO statements
      expect(parsed.functions).toHaveLength(1);
      expect(parsed.functions[0].kind).toBe('plpgsql-function');
    });

    it('should deparse function with SELECT INTO correctly', () => {
      const selectIntoSql = `
        CREATE FUNCTION get_data()
        RETURNS void
        LANGUAGE plpgsql AS $$
        DECLARE
          v_result text;
        BEGIN
          SELECT * INTO v_result FROM "quoted_schema".some_table WHERE id = 1;
        END;
        $$;
      `;
      
      const parsed = parse(selectIntoSql);
      const result = deparseSync(parsed);
      
      // When this works, the deparsed SQL should have consistent quoting
      // (either all quoted or all unquoted based on QuoteUtils rules)
      expect(result).toContain('SELECT');
      expect(result).toContain('INTO');
      expect(result).toContain('v_result');
    });

    // Contrast: DELETE statements parse correctly
    it('should parse function with DELETE statement (works correctly)', () => {
      const deleteSql = `
        CREATE FUNCTION delete_data()
        RETURNS void
        LANGUAGE plpgsql AS $$
        BEGIN
          DELETE FROM some_table WHERE id = 1;
        END;
        $$;
      `;
      
      const parsed = parse(deleteSql);
      
      // DELETE statements work correctly
      expect(parsed.functions).toHaveLength(1);
      expect(parsed.functions[0].kind).toBe('plpgsql-function');
      expect(parsed.functions[0].plpgsql.hydrated).toBeDefined();
    });
  });
});
