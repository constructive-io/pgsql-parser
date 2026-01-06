import { loadModule, parsePlPgSQLSync, parseSync } from '@libpg-query/parser';
import { deparseSync, ReturnInfo } from '../src';
import { PLpgSQLParseResult } from '../src/types';

describe('RETURN statement context handling', () => {
  beforeAll(async () => {
    await loadModule();
  });

  describe('deparseSync with returnInfo context', () => {
    const parseBody = (sql: string): PLpgSQLParseResult => {
      return parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
    };

    it('should output bare RETURN for void functions', () => {
      const sql = `CREATE FUNCTION test_void() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN;
END;
$$`;
      const parsed = parseBody(sql);
      const returnInfo: ReturnInfo = { kind: 'void' };
      const result = deparseSync(parsed, undefined, returnInfo);
      
      expect(result).toContain('RETURN;');
      expect(result).not.toContain('RETURN NULL');
    });

    it('should output bare RETURN for setof functions', () => {
      const sql = `CREATE FUNCTION test_setof() RETURNS SETOF integer
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN NEXT 1;
    RETURN NEXT 2;
    RETURN;
END;
$$`;
      const parsed = parseBody(sql);
      const returnInfo: ReturnInfo = { kind: 'setof' };
      const result = deparseSync(parsed, undefined, returnInfo);
      
      expect(result).toContain('RETURN;');
      expect(result).not.toContain('RETURN NULL');
    });

    it('should output bare RETURN for trigger functions', () => {
      const sql = `CREATE FUNCTION test_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN NEW;
END;
$$`;
      const parsed = parseBody(sql);
      const returnInfo: ReturnInfo = { kind: 'trigger' };
      const result = deparseSync(parsed, undefined, returnInfo);
      
      expect(result).toContain('RETURN NEW');
    });

    it('should output bare RETURN for out_params functions', () => {
      const sql = `CREATE FUNCTION test_out(OUT result integer) RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
    result := 42;
    RETURN;
END;
$$`;
      const parsed = parseBody(sql);
      const returnInfo: ReturnInfo = { kind: 'out_params' };
      const result = deparseSync(parsed, undefined, returnInfo);
      
      expect(result).toContain('RETURN;');
      expect(result).not.toContain('RETURN NULL');
    });

    it('should output RETURN NULL for scalar functions with empty return', () => {
      const sql = `CREATE FUNCTION test_scalar(val integer) RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    IF val > 0 THEN
        RETURN 'positive';
    END IF;
    RETURN;
END;
$$`;
      const parsed = parseBody(sql);
      const returnInfo: ReturnInfo = { kind: 'scalar' };
      const result = deparseSync(parsed, undefined, returnInfo);
      
      expect(result).toContain('RETURN NULL');
    });

    it('should preserve RETURN with expression regardless of context', () => {
      const sql = `CREATE FUNCTION test_expr() RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN 42;
END;
$$`;
      const parsed = parseBody(sql);
      
      // Test with scalar context
      const scalarResult = deparseSync(parsed, undefined, { kind: 'scalar' });
      expect(scalarResult).toContain('RETURN 42');
      
      // Test with void context (shouldn't change expression returns)
      const voidResult = deparseSync(parsed, undefined, { kind: 'void' });
      expect(voidResult).toContain('RETURN 42');
    });

    it('should default to bare RETURN when no context provided (backward compatibility)', () => {
      const sql = `CREATE FUNCTION test_no_context() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN;
END;
$$`;
      const parsed = parseBody(sql);
      
      // No returnInfo provided - should default to bare RETURN
      const result = deparseSync(parsed);
      expect(result).toContain('RETURN;');
      expect(result).not.toContain('RETURN NULL');
    });
  });
});
