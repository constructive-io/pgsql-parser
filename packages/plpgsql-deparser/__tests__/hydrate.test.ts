import { loadModule, parsePlPgSQLSync } from '@libpg-query/parser';
import { hydratePlpgsqlAst, isHydratedExpr, getOriginalQuery, PLpgSQLParseResult } from '../src';

describe('hydratePlpgsqlAst', () => {
  beforeAll(async () => {
    await loadModule();
  });

  describe('basic hydration', () => {
    it('should hydrate a simple function with expressions', () => {
      const sql = `CREATE FUNCTION test_func(p_input integer) RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN p_input * 2;
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const result = hydratePlpgsqlAst(parsed);

      expect(result.errors).toHaveLength(0);
      expect(result.stats.totalExpressions).toBeGreaterThan(0);
      expect(result.stats.parsedExpressions).toBeGreaterThan(0);
    });

    it('should hydrate assignment expressions', () => {
      const sql = `CREATE FUNCTION test_func() RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_result integer;
BEGIN
    v_result := 10 + 20;
    RETURN v_result;
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const result = hydratePlpgsqlAst(parsed);

      expect(result.stats.assignmentExpressions).toBeGreaterThan(0);
      
      const assignExpr = findExprByKind(result.ast, 'assign');
      expect(assignExpr).toBeDefined();
      if (assignExpr && assignExpr.kind === 'assign') {
        expect(assignExpr.target).toBe('v_result');
        expect(assignExpr.value).toBe('10 + 20');
        expect(assignExpr.valueExpr).toBeDefined();
      }
    });

    it('should hydrate IF condition expressions', () => {
      const sql = `CREATE FUNCTION test_func(p_val integer) RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_val > 10 THEN
        RETURN 'large';
    END IF;
    RETURN 'small';
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const result = hydratePlpgsqlAst(parsed);

      expect(result.stats.sqlExpressions).toBeGreaterThan(0);
      
      const sqlExpr = findExprByKind(result.ast, 'sql-expr');
      expect(sqlExpr).toBeDefined();
      if (sqlExpr && sqlExpr.kind === 'sql-expr') {
        expect(sqlExpr.original).toBe('p_val > 10');
        expect(sqlExpr.expr).toBeDefined();
      }
    });

    it('should handle complex assignment targets', () => {
      const sql = `CREATE FUNCTION test_func() RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
    arr integer[];
BEGIN
    r.field := 10;
    arr[1] := 20;
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const result = hydratePlpgsqlAst(parsed);

      expect(result.stats.assignmentExpressions).toBeGreaterThanOrEqual(2);
    });
  });

  describe('error handling', () => {
    it('should continue on parse errors with continueOnError option', () => {
      const sql = `CREATE FUNCTION test_func() RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN 1;
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const result = hydratePlpgsqlAst(parsed, { continueOnError: true });

      expect(result.ast).toBeDefined();
    });
  });

  describe('utility functions', () => {
    it('isHydratedExpr should identify hydrated expressions', () => {
      expect(isHydratedExpr({ kind: 'raw', original: 'test', parseMode: 2 })).toBe(true);
      expect(isHydratedExpr({ kind: 'sql-expr', original: 'test', parseMode: 2, expr: { ColumnRef: { fields: [] } } } as any)).toBe(true);
      expect(isHydratedExpr({ kind: 'assign', original: 'test', parseMode: 3, target: 'x', value: '1' })).toBe(true);
      expect(isHydratedExpr('string')).toBe(false);
      expect(isHydratedExpr(null)).toBe(false);
    });

    it('getOriginalQuery should extract original query string', () => {
      expect(getOriginalQuery('test')).toBe('test');
      expect(getOriginalQuery({ kind: 'raw', original: 'original', parseMode: 2 })).toBe('original');
      expect(getOriginalQuery({ kind: 'sql-expr', original: 'expr', parseMode: 2, expr: { ColumnRef: { fields: [] } } } as any)).toBe('expr');
    });
  });

  describe('hydration stats', () => {
    it('should track hydration statistics', () => {
      const sql = `CREATE FUNCTION test_func(p_val integer) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_result integer := 0;
BEGIN
    v_result := p_val * 2;
    IF v_result > 100 THEN
        v_result := 100;
    END IF;
    RETURN v_result;
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const result = hydratePlpgsqlAst(parsed);

      expect(result.stats.totalExpressions).toBeGreaterThan(0);
      expect(result.stats.parsedExpressions + result.stats.failedExpressions + result.stats.rawExpressions)
        .toBe(result.stats.totalExpressions);
    });
  });
});

function findExprByKind(obj: any, kind: string): any {
  if (obj === null || obj === undefined) return null;
  
  if (typeof obj === 'object') {
    if ('PLpgSQL_expr' in obj) {
      const query = obj.PLpgSQL_expr.query;
      if (query && typeof query === 'object' && query.kind === kind) {
        return query;
      }
    }
    
    for (const value of Object.values(obj)) {
      const found = findExprByKind(value, kind);
      if (found) return found;
    }
  }
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findExprByKind(item, kind);
      if (found) return found;
    }
  }
  
  return null;
}
