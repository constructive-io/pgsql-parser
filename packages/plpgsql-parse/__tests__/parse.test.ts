import { loadModule } from '@libpg-query/parser';
import { parseSync } from '../src/parse';
import { isRawComment, isRawWhitespace, isRawStmt } from 'pgsql-parse';

beforeAll(async () => {
  await loadModule();
});

describe('parseSync', () => {
  it('should parse a simple PL/pgSQL function and detect body comments', () => {
    const sql = `CREATE FUNCTION get_one() RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  -- Return one
  RETURN 1;
END;
$$;`;
    const result = parseSync(sql);
    expect(result.enhanced).toBeDefined();
    expect(result.enhanced.stmts.length).toBeGreaterThan(0);
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].comments).toHaveLength(1);
    expect(result.functions[0].comments[0].text).toBe('-- Return one');
  });

  it('should detect multiple body comments', () => {
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
    const result = parseSync(sql);
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].comments).toHaveLength(2);
    expect(result.functions[0].comments[0].text).toBe('-- First comment');
    expect(result.functions[0].comments[1].text).toBe('-- Second comment');
  });

  it('should return empty functions array for non-plpgsql functions', () => {
    const sql = `CREATE FUNCTION get_one() RETURNS integer
LANGUAGE sql
AS $$ SELECT 1; $$;`;
    const result = parseSync(sql);
    expect(result.functions).toHaveLength(0);
  });

  it('should handle functions without body comments', () => {
    const sql = `CREATE FUNCTION get_one() RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 1;
END;
$$;`;
    const result = parseSync(sql);
    // No comments in body → no FunctionComments entry
    expect(result.functions).toHaveLength(0);
  });

  it('should preserve outer SQL comments in enhanced result', () => {
    const sql = `-- Create a helper function
CREATE FUNCTION get_one() RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  -- Body comment
  RETURN 1;
END;
$$;`;
    const result = parseSync(sql);
    // Outer comment should be in enhanced.stmts
    const outerComments = result.enhanced.stmts.filter(s => isRawComment(s));
    expect(outerComments.length).toBeGreaterThan(0);
    // Body comment should be in functions
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].comments[0].text).toBe('-- Body comment');
  });

  it('should handle multiple functions in one SQL string', () => {
    const sql = `CREATE FUNCTION fn_a() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  -- Comment in A
  RETURN;
END;
$$;

CREATE FUNCTION fn_b() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  -- Comment in B
  RETURN;
END;
$$;`;
    const result = parseSync(sql);
    expect(result.functions).toHaveLength(2);
    expect(result.functions[0].comments[0].text).toBe('-- Comment in A');
    expect(result.functions[1].comments[0].text).toBe('-- Comment in B');
  });

  it('should store the original body text', () => {
    const sql = `CREATE FUNCTION test_fn() RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  -- A comment
  RETURN 1;
END;
$$;`;
    const result = parseSync(sql);
    expect(result.functions[0].originalBody).toContain('-- A comment');
    expect(result.functions[0].originalBody).toContain('RETURN 1');
  });

  it('should handle mixed SQL and PL/pgSQL statements', () => {
    const sql = `-- A regular table
CREATE TABLE users (id serial PRIMARY KEY);

-- A PL/pgSQL function
CREATE FUNCTION count_users() RETURNS integer
LANGUAGE plpgsql AS $$
BEGIN
  -- Count them
  RETURN (SELECT count(*) FROM users);
END;
$$;`;
    const result = parseSync(sql);
    // Should have real stmts + comments in enhanced
    const realStmts = result.enhanced.stmts.filter(s => isRawStmt(s));
    expect(realStmts.length).toBe(2); // CREATE TABLE + CREATE FUNCTION
    // Should detect the PL/pgSQL function's body comments
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].comments[0].text).toBe('-- Count them');
  });
});
