import { loadModule, parseSync, walkSql } from '../src';

beforeAll(async () => {
  await loadModule();
});

const BROKEN_FUNCTION_SQL = `
  CREATE FUNCTION broken_connectors() RETURNS void
  LANGUAGE plpgsql AS $$
  BEGIN
    UPDATE connectors SET instance_id = ;
  END;
  $$;
`;

describe('walkSql PL/pgSQL body errors', () => {
  it('reports a broken PL/pgSQL body as an abort and records its statement index', () => {
    const parsed = parseSync(BROKEN_FUNCTION_SQL);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].stmtIndex).toBe(0);

    const result = walkSql(BROKEN_FUNCTION_SQL, {});
    expect(result.aborted).toBe(true);
    expect(result.reason).toBeTruthy();
    expect(result.reasons).toEqual([parsed.errors[0].message]);
  });

  it('walks valid PL/pgSQL bodies', () => {
    const visited: string[] = [];
    const result = walkSql(
      `
        CREATE FUNCTION valid_connectors() RETURNS void
        LANGUAGE plpgsql AS $$
        BEGIN
          UPDATE connectors SET instance_id = 1;
        END;
        $$;
      `,
      (path) => {
        if (path.tag.startsWith('PLpgSQL_')) {
          visited.push(path.tag);
        }
      }
    );

    expect(result.aborted).toBe(false);
    expect(visited).toContain('PLpgSQL_function');
    expect(visited).toContain('PLpgSQL_stmt_execsql');
  });

  it('does not parse broken bodies when walkFunctionBodies is false', () => {
    const result = walkSql(BROKEN_FUNCTION_SQL, {}, { walkFunctionBodies: false });
    expect(result.aborted).toBe(false);
  });

  it('does not inspect non-PL/pgSQL function bodies', () => {
    const result = walkSql(
      `
        CREATE FUNCTION sql_function() RETURNS integer
        LANGUAGE sql AS $$ THIS IS NOT VALID SQL BODY TEXT $$;
      `,
      {},
    );

    expect(result.aborted).toBe(false);
  });
});
