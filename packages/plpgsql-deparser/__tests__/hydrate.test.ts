import { loadModule, parsePlPgSQLSync } from '@libpg-query/parser';
import { hydratePlpgsqlAst, dehydratePlpgsqlAst, deparseSync, isHydratedExpr, getOriginalQuery, PLpgSQLParseResult } from '../src';

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

  describe('idempotent hydration', () => {
    it('should handle already hydrated AST without errors', () => {
      const sql = `CREATE FUNCTION test_func() RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_user "my-schema".users;
BEGIN
    v_user := (SELECT * FROM "my-schema".users LIMIT 1);
    RETURN;
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      
      // First hydration
      const result1 = hydratePlpgsqlAst(parsed);
      expect(result1.errors).toHaveLength(0);
      
      // Second hydration on already hydrated AST should not throw
      const result2 = hydratePlpgsqlAst(result1.ast);
      expect(result2.errors).toHaveLength(0);
      
      // The AST should still be valid and deparseable
      const dehydrated = dehydratePlpgsqlAst(result2.ast);
      const deparsed = deparseSync(dehydrated);
      expect(deparsed).toContain('my-schema');
    });

    it('should return already hydrated expressions unchanged', () => {
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
      
      // First hydration
      const result1 = hydratePlpgsqlAst(parsed);
      const assignExpr1 = findExprByKind(result1.ast, 'assign');
      expect(assignExpr1).toBeDefined();
      
      // Second hydration
      const result2 = hydratePlpgsqlAst(result1.ast);
      const assignExpr2 = findExprByKind(result2.ast, 'assign');
      
      // The expression should be the same (unchanged)
      expect(assignExpr2).toBeDefined();
      expect(assignExpr2.kind).toBe('assign');
      expect(assignExpr2.target).toBe(assignExpr1.target);
      expect(assignExpr2.value).toBe(assignExpr1.value);
    });
  });

  describe('heterogeneous deparse (AST-based transformations)', () => {
    it('should deparse modified sql-expr AST nodes (schema renaming)', () => {
      // Note: This test only checks RangeVar nodes in SQL expressions.
      // Type references in DECLARE (PLpgSQL_type.typname) are strings, not AST nodes,
      // and require separate string-based transformation.
      const sql = `CREATE FUNCTION test_func() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM "old-schema".users WHERE id = 1) THEN
        RAISE NOTICE 'found';
    END IF;
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const { ast: hydratedAst } = hydratePlpgsqlAst(parsed);

      // Modify schema names in the hydrated AST
      transformSchemaNames(hydratedAst, 'old-schema', 'new_schema');

      // Dehydrate and deparse
      const dehydratedAst = dehydratePlpgsqlAst(hydratedAst);
      const deparsedBody = deparseSync(dehydratedAst);

      // The deparsed body should contain the new schema name
      expect(deparsedBody).toContain('new_schema');
      // And should NOT contain the old schema name
      expect(deparsedBody).not.toContain('old-schema');
    });

    it('should deparse modified assign AST nodes (schema renaming in assignments)', () => {
      const sql = `CREATE FUNCTION test_func() RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    v_count := (SELECT count(*) FROM "old-schema".users);
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const { ast: hydratedAst } = hydratePlpgsqlAst(parsed);

      // Modify schema names in the hydrated AST
      transformSchemaNames(hydratedAst, 'old-schema', 'new_schema');

      // Dehydrate and deparse
      const dehydratedAst = dehydratePlpgsqlAst(hydratedAst);
      const deparsedBody = deparseSync(dehydratedAst);

      // The deparsed body should contain the new schema name
      expect(deparsedBody).toContain('new_schema');
      // And should NOT contain the old schema name
      expect(deparsedBody).not.toContain('old-schema');
    });

    it('should deparse modified sql-stmt AST nodes (schema renaming in SQL statements)', () => {
      const sql = `CREATE FUNCTION test_func() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO "old-schema".logs (message) VALUES ('test');
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const { ast: hydratedAst } = hydratePlpgsqlAst(parsed);

      // Modify schema names in the hydrated AST
      transformSchemaNames(hydratedAst, 'old-schema', 'new_schema');

      // Dehydrate and deparse
      const dehydratedAst = dehydratePlpgsqlAst(hydratedAst);
      const deparsedBody = deparseSync(dehydratedAst);

      // The deparsed body should contain the new schema name
      expect(deparsedBody).toContain('new_schema');
      // And should NOT contain the old schema name
      expect(deparsedBody).not.toContain('old-schema');
    });
  });
});

/**
 * Helper function to transform schema names in a hydrated PL/pgSQL AST.
 * This walks the AST and modifies schemaname properties wherever they appear.
 */
function transformSchemaNames(obj: any, oldSchema: string, newSchema: string): void {
  if (obj === null || obj === undefined) return;

  if (typeof obj === 'object') {
    // Check for RangeVar nodes (table references) - wrapped in RangeVar key
    if ('RangeVar' in obj && obj.RangeVar?.schemaname === oldSchema) {
      obj.RangeVar.schemaname = newSchema;
    }
    
    // Check for direct schemaname property (e.g., InsertStmt.relation, UpdateStmt.relation)
    // These are RangeVar-like objects without the RangeVar wrapper
    if ('schemaname' in obj && obj.schemaname === oldSchema && 'relname' in obj) {
      obj.schemaname = newSchema;
    }

    // Check for hydrated expressions with sql-expr kind
    if ('PLpgSQL_expr' in obj) {
      const query = obj.PLpgSQL_expr.query;
      if (query && typeof query === 'object') {
        // Transform the embedded SQL AST
        if (query.kind === 'sql-expr' && query.expr) {
          transformSchemaNames(query.expr, oldSchema, newSchema);
        }
        if (query.kind === 'sql-stmt' && query.parseResult) {
          transformSchemaNames(query.parseResult, oldSchema, newSchema);
        }
        if (query.kind === 'assign') {
          if (query.valueExpr) {
            transformSchemaNames(query.valueExpr, oldSchema, newSchema);
          }
          if (query.targetExpr) {
            transformSchemaNames(query.targetExpr, oldSchema, newSchema);
          }
        }
      }
    }

    for (const value of Object.values(obj)) {
      transformSchemaNames(value, oldSchema, newSchema);
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      transformSchemaNames(item, oldSchema, newSchema);
    }
  }
}

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
