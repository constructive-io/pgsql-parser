import type { WalkContext } from '../src';
import { loadModule, walkSql } from '../src';

beforeAll(async () => {
  await loadModule();
});

const CREATE_FUNCTION_SQL = `
  CREATE FUNCTION my_func() RETURNS void LANGUAGE plpgsql AS $$
  DECLARE
    v_row metaschema_public.users%ROWTYPE;
  BEGIN
    SELECT * INTO v_row FROM metaschema_public.users WHERE id = 1;
    INSERT INTO public.audit_log (msg) VALUES ('accessed');
  END;
  $$;
`;

describe('walkSql', () => {
  describe('basic traversal', () => {
    it('parses and walks a simple SELECT', () => {
      const visited: string[] = [];
      const result = walkSql('SELECT * FROM public.users', {
        RangeVar: (path) => {
          visited.push(`${path.node.schemaname ?? ''}.${path.node.relname}`);
        },
      });
      expect(result.aborted).toBe(false);
      expect(visited).toContain('public.users');
    });

    it('visits function calls', () => {
      const funcs: string[] = [];
      walkSql("SELECT pg_catalog.set_config('a', 'b', false)", {
        FuncCall: (path) => {
          funcs.push(
            (path.node.funcname ?? [])
              .map((part: any) => part?.String?.sval ?? '')
              .filter(Boolean)
              .join('.'),
          );
        },
      });
      expect(funcs).toContain('pg_catalog.set_config');
    });

    it('handles empty SQL', () => {
      expect(walkSql('', {}).aborted).toBe(false);
      expect(walkSql('   ', {}).aborted).toBe(false);
    });

    it('reports unparseable SQL as an abort rather than throwing', () => {
      const result = walkSql('NOT VALID SQL !!!', {});
      expect(result.aborted).toBe(true);
      expect(result.reason).toBeDefined();
    });
  });

  describe('statement context', () => {
    it('fires the statement hook once per statement with its tag', () => {
      const tags: string[] = [];
      walkSql('SELECT 1; INSERT INTO t(a) VALUES(1)', {
        statement: (path) => {
          tags.push(path.tag);
        },
      });
      expect(tags).toEqual(['SelectStmt', 'InsertStmt']);
    });

    it('marks writes and reads', () => {
      const contexts: WalkContext[] = [];
      const collect = {
        statement: (_path: unknown, ctx: WalkContext): void => {
          contexts.push(ctx);
        },
      };

      walkSql('INSERT INTO t(a) VALUES(1)', collect);
      expect(contexts[0].isWrite).toBe(true);
      expect(contexts[0].isRead).toBe(false);

      contexts.length = 0;
      walkSql('SELECT * FROM t', collect);
      expect(contexts[0].isWrite).toBe(false);
      expect(contexts[0].isRead).toBe(true);
    });

    it('gives nested nodes the context of their own statement', () => {
      const seen: Array<{ table: string; stmtTag: string | null; isWrite: boolean }> = [];
      walkSql('SELECT * FROM a.reads; UPDATE b.writes SET x = 1', {
        RangeVar: (path, ctx) => {
          seen.push({ table: path.node.relname, stmtTag: ctx.stmtTag, isWrite: ctx.isWrite });
        },
      });
      expect(seen).toEqual([
        { table: 'reads', stmtTag: 'SelectStmt', isWrite: false },
        { table: 'writes', stmtTag: 'UpdateStmt', isWrite: true },
      ]);
    });

    it('refines the context to the nearest enclosing statement', () => {
      const seen: Array<{ table: string; stmtTag: string | null; isWrite: boolean }> = [];
      walkSql(
        'WITH w AS (INSERT INTO a.written VALUES (1) RETURNING *) SELECT * FROM b.read',
        {
          RangeVar: (path, ctx) => {
            seen.push({ table: path.node.relname, stmtTag: ctx.stmtTag, isWrite: ctx.isWrite });
          },
        },
      );
      expect(seen).toEqual(
        expect.arrayContaining([
          { table: 'written', stmtTag: 'InsertStmt', isWrite: true },
          { table: 'read', stmtTag: 'SelectStmt', isWrite: false },
        ]),
      );
    });

    it('marks a write inside a function body as a write', () => {
      const seen: Array<{ table: string; isWrite: boolean; functionName: string | null }> = [];
      walkSql(
        `CREATE FUNCTION w() RETURNS void LANGUAGE plpgsql AS $$
         BEGIN
           INSERT INTO infra.servers (name) VALUES ('x');
         END;
         $$;`,
        {
          RangeVar: (path, ctx) => {
            seen.push({
              table: path.node.relname,
              isWrite: ctx.isWrite,
              functionName: ctx.functionName,
            });
          },
        },
      );
      expect(seen).toEqual([{ table: 'servers', isWrite: true, functionName: 'w' }]);
    });

    it('numbers statements', () => {
      const indexes: number[] = [];
      walkSql('SELECT 1; SELECT 2; SELECT 3', {
        statement: (_path, ctx) => void indexes.push(ctx.stmtIndex),
      });
      expect(indexes).toEqual([0, 1, 2]);
    });
  });

  describe('visitor composition', () => {
    it('fires every visitor on each node in a single pass', () => {
      const first: string[] = [];
      const second: string[] = [];
      walkSql('SELECT * FROM users', [
        { RangeVar: (path) => void first.push(path.node.relname) },
        { RangeVar: (path) => void second.push(path.node.relname) },
      ]);
      expect(first).toEqual(['users']);
      expect(second).toEqual(['users']);
    });

    it('accepts a bare walker function', () => {
      const tags: string[] = [];
      walkSql('SELECT 1', (path) => void tags.push(path.tag));
      expect(tags).toContain('SelectStmt');
    });
  });

  describe('control flow', () => {
    it('skips a node\u2019s children when a visitor returns false', () => {
      const tags: string[] = [];
      walkSql('SELECT * FROM users', {
        SelectStmt: () => false,
        RangeVar: (path) => void tags.push(path.tag),
      });
      expect(tags).toEqual([]);
    });

    it('ends the whole walk on abort, skipping later statements', () => {
      const tables: string[] = [];
      const result = walkSql('SELECT * FROM a.one; SELECT * FROM b.two', {
        RangeVar: (path, ctx) => {
          tables.push(path.node.relname);
          ctx.abort('seen enough');
        },
      });
      expect(tables).toEqual(['one']);
      expect(result.aborted).toBe(true);
      expect(result.reason).toBe('seen enough');
      expect(result.reasons).toEqual(['seen enough']);
    });

    it('aborts from inside a function body', () => {
      const result = walkSql(CREATE_FUNCTION_SQL, {
        PLpgSQL_stmt_execsql: (_path, ctx) => ctx.abort('no SQL in bodies'),
      });
      expect(result.aborted).toBe(true);
      expect(result.reason).toBe('no SQL in bodies');
    });
  });

  describe('function bodies', () => {
    it('visits SQL nodes inside hydrated PL/pgSQL bodies', () => {
      const tables: string[] = [];
      const result = walkSql(CREATE_FUNCTION_SQL, {
        RangeVar: (path) => {
          if (path.node.schemaname) tables.push(`${path.node.schemaname}.${path.node.relname}`);
        },
      });
      expect(result.aborted).toBe(false);
      expect(tables).toContain('metaschema_public.users');
      expect(tables).toContain('public.audit_log');
    });

    it('reports insideFunction and the function name', () => {
      const contexts: WalkContext[] = [];
      walkSql(CREATE_FUNCTION_SQL, {
        RangeVar: (_path, ctx) => void contexts.push(ctx),
      });
      const insideFn = contexts.filter((ctx) => ctx.insideFunction);
      expect(insideFn.length).toBeGreaterThan(0);
      expect(insideFn[0].functionName).toBe('my_func');
    });

    it('visits every statement of a multi-statement body', () => {
      const schemas: string[] = [];
      walkSql(
        `CREATE FUNCTION multi_stmt() RETURNS void LANGUAGE plpgsql AS $$
         BEGIN
           INSERT INTO schema_a.table1 (x) VALUES (1);
           UPDATE schema_b.table2 SET x = 2;
           DELETE FROM schema_c.table3 WHERE id = 3;
         END;
         $$;`,
        { RangeVar: (path) => void (path.node.schemaname && schemas.push(path.node.schemaname)) },
      );
      expect(schemas).toEqual(expect.arrayContaining(['schema_a', 'schema_b', 'schema_c']));
    });

    it('visits PL/pgSQL-only nodes such as dynamic EXECUTE', () => {
      const dynamic = walkSql(
        `CREATE FUNCTION dangerous() RETURNS void LANGUAGE plpgsql AS $$
         BEGIN
           EXECUTE 'DROP TABLE users';
         END;
         $$;`,
        { PLpgSQL_stmt_dynexecute: (_path, ctx) => ctx.abort('dynamic EXECUTE') },
      );
      expect(dynamic.aborted).toBe(true);
      expect(dynamic.reason).toBe('dynamic EXECUTE');
    });

    it('leaves bodies unparsed when walkFunctionBodies is false', () => {
      const result = walkSql(
        `CREATE FUNCTION dangerous() RETURNS void LANGUAGE plpgsql AS $$
         BEGIN
           EXECUTE 'DROP TABLE users';
         END;
         $$;`,
        { PLpgSQL_stmt_dynexecute: (_path, ctx) => ctx.abort('dynamic EXECUTE') },
        { walkFunctionBodies: false },
      );
      expect(result.aborted).toBe(false);
    });

    it('visits function calls made with PERFORM', () => {
      const funcs: string[] = [];
      walkSql(
        `CREATE FUNCTION caller() RETURNS void LANGUAGE plpgsql AS $$
         BEGIN
           PERFORM pg_catalog.set_config('role', 'admin', false);
         END;
         $$;`,
        {
          FuncCall: (path) => {
            funcs.push(
              (path.node.funcname ?? [])
                .map((part: any) => part?.String?.sval ?? '')
                .filter(Boolean)
                .join('.'),
            );
          },
        },
      );
      expect(funcs).toContain('pg_catalog.set_config');
    });
  });
});
