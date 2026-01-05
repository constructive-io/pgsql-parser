import { parse, walk, walkParsedScript, PLpgSQLNodePath, loadModule } from '../src';
import type { PLpgSQLVisitor } from '../src';

describe('plpgsql-parser traverse', () => {
  beforeAll(async () => {
    await loadModule();
  });

  const simpleFunctionSql = `
    CREATE FUNCTION test_func(p_id int)
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_name text;
    BEGIN
      SELECT name INTO v_name FROM users WHERE id = p_id;
      RAISE NOTICE 'Hello %', v_name;
    END;
    $$;
  `;

  describe('walk', () => {
    it('should visit PL/pgSQL nodes with a visitor object', () => {
      const parsed = parse(simpleFunctionSql);
      expect(parsed.functions.length).toBe(1);
      
      const visitedTags: string[] = [];
      const visitor: PLpgSQLVisitor = {
        PLpgSQL_function: (path) => {
          visitedTags.push(path.tag);
        },
        PLpgSQL_stmt_block: (path) => {
          visitedTags.push(path.tag);
        },
        PLpgSQL_var: (path) => {
          visitedTags.push(path.tag);
        },
        PLpgSQL_stmt_execsql: (path) => {
          visitedTags.push(path.tag);
        },
        PLpgSQL_stmt_raise: (path) => {
          visitedTags.push(path.tag);
        },
      };
      
      walk(parsed.functions[0].plpgsql.hydrated, visitor);
      
      expect(visitedTags).toContain('PLpgSQL_function');
      expect(visitedTags).toContain('PLpgSQL_stmt_block');
      expect(visitedTags).toContain('PLpgSQL_var');
      expect(visitedTags).toContain('PLpgSQL_stmt_execsql');
      expect(visitedTags).toContain('PLpgSQL_stmt_raise');
    });

    it('should visit PL/pgSQL nodes with a walker function', () => {
      const parsed = parse(simpleFunctionSql);
      
      const visitedTags: string[] = [];
      walk(parsed.functions[0].plpgsql.hydrated, (path: PLpgSQLNodePath) => {
        visitedTags.push(path.tag);
      });
      
      expect(visitedTags.length).toBeGreaterThan(0);
      expect(visitedTags).toContain('PLpgSQL_function');
    });

    it('should provide correct path information', () => {
      const parsed = parse(simpleFunctionSql);
      
      let blockPath: (string | number)[] = [];
      const visitor: PLpgSQLVisitor = {
        PLpgSQL_stmt_block: (path) => {
          blockPath = path.path;
        },
      };
      
      walk(parsed.functions[0].plpgsql.hydrated, visitor);
      
      expect(blockPath).toContain('action');
    });

    it('should allow skipping children by returning false', () => {
      const parsed = parse(simpleFunctionSql);
      
      const visitedTags: string[] = [];
      const visitor: PLpgSQLVisitor = {
        PLpgSQL_function: (path) => {
          visitedTags.push(path.tag);
          return false; // Skip children
        },
        PLpgSQL_stmt_block: (path) => {
          visitedTags.push(path.tag);
        },
      };
      
      walk(parsed.functions[0].plpgsql.hydrated, visitor);
      
      expect(visitedTags).toContain('PLpgSQL_function');
      expect(visitedTags).not.toContain('PLpgSQL_stmt_block');
    });
  });

  describe('walkParsedScript', () => {
    it('should walk both SQL and PL/pgSQL nodes', () => {
      const parsed = parse(simpleFunctionSql);
      
      const plpgsqlTags: string[] = [];
      const sqlTags: string[] = [];
      
      walkParsedScript(
        parsed,
        {
          PLpgSQL_function: (path) => {
            plpgsqlTags.push(path.tag);
          },
          PLpgSQL_stmt_block: (path) => {
            plpgsqlTags.push(path.tag);
          },
        },
        {
          CreateFunctionStmt: (path) => {
            sqlTags.push(path.tag);
          },
        }
      );
      
      expect(plpgsqlTags).toContain('PLpgSQL_function');
      expect(sqlTags).toContain('CreateFunctionStmt');
    });
  });

  describe('SQL expression traversal', () => {
    it('should traverse into hydrated SQL expressions when sqlVisitor is provided', () => {
      const parsed = parse(simpleFunctionSql);
      
      const sqlTags: string[] = [];
      const visitor: PLpgSQLVisitor = {
        PLpgSQL_expr: () => {
          // Just visit the expression node
        },
      };
      
      walk(parsed.functions[0].plpgsql.hydrated, visitor, {
        walkSqlExpressions: true,
        sqlVisitor: {
          SelectStmt: (path) => {
            sqlTags.push(path.tag);
          },
          RangeVar: (path) => {
            sqlTags.push(path.tag);
          },
        },
      });
      
      // The SELECT statement inside the function should be visited
      expect(sqlTags).toContain('SelectStmt');
      expect(sqlTags).toContain('RangeVar');
    });
  });

  describe('control flow statements', () => {
    it('should traverse IF statements', () => {
      const ifFunctionSql = `
        CREATE FUNCTION test_if(p_val int)
        RETURNS text
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF p_val > 10 THEN
            RETURN 'big';
          ELSIF p_val > 5 THEN
            RETURN 'medium';
          ELSE
            RETURN 'small';
          END IF;
        END;
        $$;
      `;
      
      const parsed = parse(ifFunctionSql);
      const visitedTags: string[] = [];
      
      walk(parsed.functions[0].plpgsql.hydrated, (path: PLpgSQLNodePath) => {
        visitedTags.push(path.tag);
      });
      
      expect(visitedTags).toContain('PLpgSQL_stmt_if');
      expect(visitedTags).toContain('PLpgSQL_if_elsif');
      expect(visitedTags).toContain('PLpgSQL_stmt_return');
    });

    it('should traverse LOOP statements', () => {
      const loopFunctionSql = `
        CREATE FUNCTION test_loop()
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        DECLARE
          i int := 0;
        BEGIN
          WHILE i < 10 LOOP
            i := i + 1;
          END LOOP;
        END;
        $$;
      `;
      
      const parsed = parse(loopFunctionSql);
      const visitedTags: string[] = [];
      
      walk(parsed.functions[0].plpgsql.hydrated, (path: PLpgSQLNodePath) => {
        visitedTags.push(path.tag);
      });
      
      expect(visitedTags).toContain('PLpgSQL_stmt_while');
      expect(visitedTags).toContain('PLpgSQL_stmt_assign');
    });

    it('should traverse FOR loops', () => {
      const forFunctionSql = `
        CREATE FUNCTION test_for()
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        DECLARE
          rec record;
        BEGIN
          FOR rec IN SELECT * FROM users LOOP
            RAISE NOTICE '%', rec.name;
          END LOOP;
        END;
        $$;
      `;
      
      const parsed = parse(forFunctionSql);
      const visitedTags: string[] = [];
      
      walk(parsed.functions[0].plpgsql.hydrated, (path: PLpgSQLNodePath) => {
        visitedTags.push(path.tag);
      });
      
      expect(visitedTags).toContain('PLpgSQL_stmt_fors');
      expect(visitedTags).toContain('PLpgSQL_stmt_raise');
    });
  });
});
