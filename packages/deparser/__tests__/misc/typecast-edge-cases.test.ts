import { expectParseDeparse } from '../../test-utils';

describe('TypeCast with negative numbers', () => {
  it('should handle negative integer with CAST syntax', async () => {
    const sql = `SELECT -1::integer`;
    const result = await expectParseDeparse(sql);
    // Negative numbers require CAST() syntax for precedence
    // Note: PostgreSQL normalizes "integer" to "int" in the AST
    expect(result).toBe(`SELECT CAST(-1 AS int)`);
  });

  it('should handle parenthesized negative integer', async () => {
    const sql = `SELECT (-1)::integer`;
    const result = await expectParseDeparse(sql);
    // Parenthesized negative numbers can use :: syntax
    // Note: PostgreSQL normalizes "integer" to "int" in the AST
    expect(result).toBe(`SELECT (-1)::int`);
  });

  it('should handle negative float with CAST syntax', async () => {
    const sql = `SELECT -1.5::numeric`;
    const result = await expectParseDeparse(sql);
    // Negative floats require CAST() syntax for precedence
    expect(result).toBe(`SELECT CAST(-1.5 AS numeric)`);
  });

  it('should handle parenthesized negative float', async () => {
    const sql = `SELECT (-1.5)::numeric`;
    const result = await expectParseDeparse(sql);
    // Parenthesized negative floats use CAST() syntax, parentheses removed
    expect(result).toBe(`SELECT CAST(-1.5 AS numeric)`);
  });

  it('should handle negative bigint', async () => {
    const sql = `SELECT -9223372036854775808::bigint`;
    const result = await expectParseDeparse(sql);
    // Negative bigints: deparser outputs unary minus operator separately
    expect(result).toBe(`SELECT - CAST(9223372036854775808 AS bigint)`);
  });
});

describe('TypeCast with complex expressions', () => {
  it('should handle arithmetic expression with CAST syntax', async () => {
    const sql = `SELECT (1 + 2)::integer`;
    const result = await expectParseDeparse(sql);
    // Complex expressions require CAST() syntax
    // Note: PostgreSQL normalizes "integer" to "int" in the AST
    // Note: Deparser removes outer parentheses from arithmetic expressions
    expect(result).toBe(`SELECT CAST(1 + 2 AS int)`);
  });

  it('should handle subtraction expression', async () => {
    const sql = `SELECT (a - b)::integer FROM t`;
    const result = await expectParseDeparse(sql);
    // Complex expressions require CAST() syntax
    // Note: PostgreSQL normalizes "integer" to "int" in the AST
    // Note: Deparser removes outer parentheses from arithmetic expressions
    expect(result).toBe(`SELECT CAST(a - b AS int) FROM t`);
  });

  it('should handle CASE expression with CAST syntax', async () => {
    const sql = `SELECT (CASE WHEN a > 0 THEN 1 ELSE 2 END)::integer FROM t`;
    const result = await expectParseDeparse(sql);
    // Complex expressions require CAST() syntax
    // Note: PostgreSQL normalizes "integer" to "int" in the AST
    // Note: Deparser removes outer parentheses from CASE expressions
    // Note: Deparser also removes parentheses from WHEN conditions
    expect(result).toBe(`SELECT CAST(CASE WHEN a > 0 THEN 1 ELSE 2 END AS int) FROM t`);
  });

  it('should handle boolean expression', async () => {
    const sql = `SELECT (a IS NULL)::boolean FROM t`;
    const result = await expectParseDeparse(sql);
    // Complex expressions require CAST() syntax
    // Note: Deparser removes outer parentheses from boolean expressions
    expect(result).toBe(`SELECT CAST(a IS NULL AS boolean) FROM t`);
  });

  it('should handle comparison expression', async () => {
    const sql = `SELECT (a > b)::boolean FROM t`;
    const result = await expectParseDeparse(sql);
    // Complex expressions require CAST() syntax
    // Note: Deparser removes outer parentheses from comparison expressions
    expect(result).toBe(`SELECT CAST(a > b AS boolean) FROM t`);
  });
});

describe('TypeCast with function calls', () => {
  it('should handle function call with :: syntax and parentheses', async () => {
    const sql = `SELECT substring('test', 1, 2)::text`;
    const result = await expectParseDeparse(sql);
    // Function calls can use :: syntax with parentheses for precedence
    expect(result).toBe(`SELECT (substring('test', 1, 2))::text`);
  });

  it('should handle qualified function call', async () => {
    const sql = `SELECT pg_catalog.substring('test', 1, 2)::text`;
    const result = await expectParseDeparse(sql);
    // Qualified function calls can use :: syntax with parentheses
    expect(result).toBe(`SELECT (pg_catalog.substring('test', 1, 2))::text`);
  });

  it('should handle aggregate function', async () => {
    const sql = `SELECT sum(x)::numeric FROM t`;
    const result = await expectParseDeparse(sql);
    // Aggregate functions can use :: syntax with parentheses
    expect(result).toBe(`SELECT (sum(x))::numeric FROM t`);
  });

  it('should handle nested function calls', async () => {
    const sql = `SELECT upper(lower('TEST'))::text`;
    const result = await expectParseDeparse(sql);
    // Nested function calls can use :: syntax with parentheses
    expect(result).toBe(`SELECT (upper(lower('TEST')))::text`);
  });
});

describe('TypeCast with pg_catalog.bpchar', () => {
  it('should preserve CAST syntax for qualified bpchar', async () => {
    const sql = `SELECT 'x'::pg_catalog.bpchar`;
    const result = await expectParseDeparse(sql);
    // Should use CAST() syntax for round-trip fidelity
    expect(result).toBe(`SELECT CAST('x' AS pg_catalog.bpchar)`);
  });

  it('should use :: syntax for unqualified bpchar', async () => {
    const sql = `SELECT 'x'::bpchar`;
    const result = await expectParseDeparse(sql);
    expect(result).toBe(`SELECT 'x'::bpchar`);
  });

  it('should handle bpchar with length modifier', async () => {
    const sql = `SELECT 'hello'::bpchar(10)`;
    const result = await expectParseDeparse(sql);
    // bpchar with length modifier uses CAST() syntax (not :: syntax)
    expect(result).toBe(`SELECT CAST('hello' AS bpchar(10))`);
  });
});

describe('TypeCast with string literals containing special characters', () => {
  it('should handle string literal with parenthesis', async () => {
    const sql = `SELECT '('::text`;
    const result = await expectParseDeparse(sql);
    // Should use :: syntax (not CAST) - improvement over old string-based heuristic
    expect(result).toBe(`SELECT '('::text`);
  });

  it('should handle string literal starting with minus', async () => {
    const sql = `SELECT '-hello'::text`;
    const result = await expectParseDeparse(sql);
    // Should use :: syntax (not CAST) - improvement over old string-based heuristic
    expect(result).toBe(`SELECT '-hello'::text`);
  });

  it('should handle string literal with multiple special chars', async () => {
    const sql = `SELECT '(-)'::text`;
    const result = await expectParseDeparse(sql);
    expect(result).toBe(`SELECT '(-)'::text`);
  });

  it('should handle empty string', async () => {
    const sql = `SELECT ''::text`;
    const result = await expectParseDeparse(sql);
    expect(result).toBe(`SELECT ''::text`);
  });
});

describe('TypeCast with simple constants', () => {
  it('should handle positive integer with :: syntax', async () => {
    const sql = `SELECT 123::integer`;
    const result = await expectParseDeparse(sql);
    // Note: PostgreSQL normalizes "integer" to "int" in the AST
    expect(result).toBe(`SELECT 123::int`);
  });

  it('should handle positive float with :: syntax', async () => {
    const sql = `SELECT 3.14::numeric`;
    const result = await expectParseDeparse(sql);
    expect(result).toBe(`SELECT 3.14::numeric`);
  });

  it('should handle boolean true', async () => {
    const sql = `SELECT true::boolean`;
    const result = await expectParseDeparse(sql);
    // Boolean constants use CAST() syntax (not :: syntax)
    expect(result).toBe(`SELECT CAST(true AS boolean)`);
  });

  it('should handle boolean false', async () => {
    const sql = `SELECT false::boolean`;
    const result = await expectParseDeparse(sql);
    // Boolean constants use CAST() syntax (not :: syntax)
    expect(result).toBe(`SELECT CAST(false AS boolean)`);
  });

  it('should handle NULL cast', async () => {
    const sql = `SELECT NULL::integer`;
    const result = await expectParseDeparse(sql);
    // NULL can use :: syntax
    // Note: PostgreSQL normalizes "integer" to "int" in the AST
    expect(result).toBe(`SELECT NULL::int`);
  });
});

describe('TypeCast with column references', () => {
  it('should handle simple column reference with :: syntax', async () => {
    const sql = `SELECT a::integer FROM t`;
    const result = await expectParseDeparse(sql);
    // Note: PostgreSQL normalizes "integer" to "int" in the AST
    expect(result).toBe(`SELECT a::int FROM t`);
  });

  it('should handle qualified column reference', async () => {
    const sql = `SELECT t.a::integer FROM t`;
    const result = await expectParseDeparse(sql);
    // Note: PostgreSQL normalizes "integer" to "int" in the AST
    expect(result).toBe(`SELECT t.a::int FROM t`);
  });

  it('should handle fully qualified column reference', async () => {
    const sql = `SELECT schema.t.a::integer FROM schema.t`;
    const result = await expectParseDeparse(sql);
    // Fully qualified column references can use :: syntax
    // Note: PostgreSQL normalizes "integer" to "int" in the AST
    expect(result).toBe(`SELECT schema.t.a::int FROM schema.t`);
  });
});

describe('TypeCast with pg_catalog types', () => {
  it('should handle pg_catalog.int4 with :: syntax', async () => {
    const sql = `SELECT 123::pg_catalog.int4`;
    const result = await expectParseDeparse(sql);
    // PostgreSQL normalizes int4 to int, and strips pg_catalog prefix
    expect(result).toBe(`SELECT 123::int`);
  });

  it('should handle pg_catalog.varchar', async () => {
    const sql = `SELECT 'hello'::pg_catalog.varchar`;
    const result = await expectParseDeparse(sql);
    // Should strip pg_catalog prefix and use :: syntax
    expect(result).toBe(`SELECT 'hello'::varchar`);
  });

  it('should handle pg_catalog.numeric', async () => {
    const sql = `SELECT 3.14::pg_catalog.numeric`;
    const result = await expectParseDeparse(sql);
    // Should strip pg_catalog prefix and use :: syntax
    expect(result).toBe(`SELECT 3.14::numeric`);
  });
});

describe('TypeCast with arrays', () => {
  it('should handle array literal cast', async () => {
    const sql = `SELECT ARRAY[1, 2, 3]::integer[]`;
    const result = await expectParseDeparse(sql);
    // Array literals require CAST() syntax
    // Note: PostgreSQL normalizes "integer[]" to "int[]" in the AST
    expect(result).toBe(`SELECT CAST(ARRAY[1, 2, 3] AS int[])`);
  });

  it('should handle array string literal cast', async () => {
    const sql = `SELECT '{1,2,3}'::integer[]`;
    const result = await expectParseDeparse(sql);
    // Array string literals require CAST() syntax
    // Note: PostgreSQL normalizes "integer[]" to "int[]" in the AST
    expect(result).toBe(`SELECT CAST('{1,2,3}' AS int[])`);
  });
});

describe('TypeCast with ROW expressions', () => {
  it('should handle ROW cast', async () => {
    const sql = `SELECT ROW(1, 2)::record`;
    const result = await expectParseDeparse(sql);
    // ROW expressions require CAST() syntax
    expect(result).toBe(`SELECT CAST(ROW(1, 2) AS record)`);
  });

  it('should handle implicit row cast', async () => {
    const sql = `SELECT (1, 2)::record`;
    const result = await expectParseDeparse(sql);
    // Implicit ROW expressions require CAST() syntax
    expect(result).toBe(`SELECT CAST((1, 2) AS record)`);
  });
});
