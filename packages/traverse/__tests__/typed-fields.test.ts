import type { Visitor } from '../src';
import { NodePath, visit, walk } from '../src';

// AST literals below are real libpg_query (PG18) parse output. Concrete
// typed embedded fields (e.g. CreatePolicyStmt.table: RangeVar) are bare
// untagged objects in libpg_query JSON — no `{RangeVar: {...}}` wrapper.

const createPolicyAst = {
  CreatePolicyStmt: {
    policy_name: 'p',
    table: { schemaname: 'app', relname: 'posts', inh: true, relpersistence: 'p', location: 19 },
    cmd_name: 'select',
    permissive: true,
    roles: [{ RoleSpec: { roletype: 'ROLESPEC_PUBLIC', location: -1 } }],
    qual: { A_Const: { boolval: { boolval: true }, location: 47 } }
  }
};

const indexStmtAst = {
  IndexStmt: {
    idxname: 'idx',
    relation: { schemaname: 'app', relname: 'posts', inh: true, relpersistence: 'p', location: 20 },
    accessMethod: 'btree',
    indexParams: [
      { IndexElem: { name: 'id', ordering: 'SORTBY_DEFAULT', nulls_ordering: 'SORTBY_NULLS_DEFAULT' } }
    ]
  }
};

const createTrigAst = {
  CreateTrigStmt: {
    trigname: 'trg',
    relation: { schemaname: 'app', relname: 'posts', inh: true, relpersistence: 'p', location: 36 },
    funcname: [{ String: { sval: 'f' } }],
    timing: 2,
    events: 4
  }
};

const alterTableAst = {
  AlterTableStmt: {
    relation: { schemaname: 'app', relname: 'posts', inh: true, relpersistence: 'p', location: 12 },
    cmds: [
      {
        AlterTableCmd: {
          subtype: 'AT_AddColumn',
          def: {
            ColumnDef: {
              colname: 'x',
              typeName: {
                names: [{ String: { sval: 'pg_catalog' } }, { String: { sval: 'int4' } }],
                typemod: -1,
                location: 35
              },
              is_local: true,
              location: 33
            }
          },
          behavior: 'DROP_RESTRICT'
        }
      }
    ],
    objtype: 'OBJECT_TABLE'
  }
};

describe('walk — typed embedded fields (untagged)', () => {
  it('visits RangeVar for CreatePolicyStmt.table', () => {
    const visited: NodePath[] = [];
    walk(createPolicyAst, { RangeVar: (path) => { visited.push(path); } });

    expect(visited).toHaveLength(1);
    expect(visited[0].node.schemaname).toBe('app');
    expect(visited[0].node.relname).toBe('posts');
    expect(visited[0].tag).toBe('RangeVar');
    expect(visited[0].path).toEqual(['table']);
    expect(visited[0].parent?.tag).toBe('CreatePolicyStmt');
  });

  it('visits RangeVar for IndexStmt.relation', () => {
    const visited: NodePath[] = [];
    walk(indexStmtAst, { RangeVar: (path) => { visited.push(path); } });

    expect(visited).toHaveLength(1);
    expect(visited[0].node.relname).toBe('posts');
    expect(visited[0].path).toEqual(['relation']);
  });

  it('visits RangeVar for CreateTrigStmt.relation', () => {
    const visited: NodePath[] = [];
    walk(createTrigAst, { RangeVar: (path) => { visited.push(path); } });

    expect(visited).toHaveLength(1);
    expect(visited[0].node.relname).toBe('posts');
    expect(visited[0].path).toEqual(['relation']);
  });

  it('visits RangeVar for AlterTableStmt.relation', () => {
    const visited: NodePath[] = [];
    walk(alterTableAst, { RangeVar: (path) => { visited.push(path); } });

    expect(visited).toHaveLength(1);
    expect(visited[0].node.relname).toBe('posts');
    expect(visited[0].path).toEqual(['relation']);
  });

  it('visits TypeName for ColumnDef.typeName (untagged typed field)', () => {
    const visited: NodePath[] = [];
    walk(alterTableAst, { TypeName: (path) => { visited.push(path); } });

    expect(visited).toHaveLength(1);
    expect(visited[0].node.names).toHaveLength(2);
    expect(visited[0].parent?.tag).toBe('ColumnDef');
  });

  it('visits RawStmt for the array-typed ParseResult.stmts field', () => {
    const parseResult = {
      ParseResult: {
        version: 180004,
        stmts: [
          { stmt: createPolicyAst, stmt_len: 52 },
          { stmt: indexStmtAst, stmt_len: 34 }
        ]
      }
    };
    const rawStmts: NodePath[] = [];
    const rangeVars: NodePath[] = [];
    walk(parseResult, {
      RawStmt: (path) => { rawStmts.push(path); },
      RangeVar: (path) => { rangeVars.push(path); }
    });

    expect(rawStmts).toHaveLength(2);
    expect(rawStmts[0].tag).toBe('RawStmt');
    expect(rawStmts[0].path).toEqual(['stmts', 0]);
    expect(rawStmts[1].path).toEqual(['stmts', 1]);
    expect(rangeVars).toHaveLength(2);
  });

  it('returning false from a synthesized-tag visitor skips its children', () => {
    const ast = {
      IndexStmt: {
        idxname: 'idx',
        relation: {
          relname: 'posts',
          inh: true,
          relpersistence: 'p',
          alias: { aliasname: 'a' }
        },
        accessMethod: 'btree'
      }
    };
    const aliases: NodePath[] = [];
    walk(ast, {
      RangeVar: () => false,
      Alias: (path) => { aliases.push(path); }
    });
    expect(aliases).toHaveLength(0);

    walk(ast, { Alias: (path) => { aliases.push(path); } });
    expect(aliases).toHaveLength(1);
    expect(aliases[0].node.aliasname).toBe('a');
  });

  it('visits Query and its nested typed fields for IntoClause.viewQuery', () => {
    // IntoClause.viewQuery and RangeTblEntry.subquery are the two concrete
    // Query-typed fields in the PG18 runtime schema.
    const ast = {
      CreateTableAsStmt: {
        into: {
          rel: { relname: 'mv', inh: true, relpersistence: 'p' },
          viewQuery: {
            commandType: 'CMD_SELECT',
            rtable: [
              {
                RangeTblEntry: {
                  rtekind: 'RTE_SUBQUERY',
                  subquery: {
                    commandType: 'CMD_SELECT',
                    jointree: { fromlist: [] as any[] }
                  },
                  eref: { aliasname: 'inner_q' }
                }
              }
            ],
            jointree: {
              fromlist: [{ RangeVar: { relname: 'src', inh: true, relpersistence: 'p' } }]
            }
          }
        },
        objtype: 'OBJECT_MATVIEW'
      }
    };

    const tags: string[] = [];
    walk(ast, (path) => { tags.push(path.tag); });

    // outer Query via IntoClause.viewQuery, inner Query via RangeTblEntry.subquery
    expect(tags.filter((t) => t === 'Query')).toHaveLength(2);
    // FromExpr synthesized for both Query.jointree fields
    expect(tags.filter((t) => t === 'FromExpr')).toHaveLength(2);
    // RangeVar: IntoClause.rel (untagged) + tagged one inside fromlist
    expect(tags.filter((t) => t === 'RangeVar')).toHaveLength(2);
    // Alias synthesized for RangeTblEntry.eref
    expect(tags).toContain('Alias');
    expect(tags).toContain('RangeTblEntry');
    expect(tags).toContain('IntoClause');
  });

  it('handles empty untagged typed values and mixed tagged/untagged arrays', () => {
    const emptyRel = { IndexStmt: { relation: {} } };
    const visited: NodePath[] = [];
    walk(emptyRel, { RangeVar: (path) => { visited.push(path); } });
    expect(visited).toHaveLength(1);
    expect(visited[0].node).toEqual({});

    // ParseResult.stmts with one bare RawStmt and one already-tagged entry
    const mixed = {
      ParseResult: {
        version: 180004,
        stmts: [
          { stmt: indexStmtAst, stmt_len: 34 },
          { RawStmt: { stmt: createTrigAst, stmt_len: 66 } }
        ]
      }
    };
    const rawStmts: NodePath[] = [];
    walk(mixed, { RawStmt: (path) => { rawStmts.push(path); } });
    expect(rawStmts).toHaveLength(2);
  });

  it('detects a bare libpg-query parse result at the root', () => {
    // libpg-query parseSync() returns {version, stmts} with no ParseResult wrapper
    const parseResult = {
      version: 180004,
      stmts: [{ stmt: createPolicyAst, stmt_len: 52 }]
    };
    const tags: string[] = [];
    walk(parseResult, (path) => { tags.push(path.tag); });

    expect(tags[0]).toBe('ParseResult');
    expect(tags[1]).toBe('RawStmt');
    expect(tags).toContain('CreatePolicyStmt');
    expect(tags).toContain('RangeVar');
  });

  it('does not treat non-root {version, stmts} shapes as ParseResult', () => {
    const tags: string[] = [];
    walk({ wrapper: { version: 180004, stmts: [] as any[] } }, (path) => { tags.push(path.tag); });
    expect(tags).toEqual([]);
  });

  it('ignores tagged wrappers whose payload is not an object', () => {
    const visited: NodePath[] = [];
    walk({ Weird: 'not-an-object' }, (path) => { visited.push(path); });
    expect(visited).toEqual([]);
  });

  it('keeps existing behavior for tagged nodes', () => {
    const visited: string[] = [];
    const visitor: Visitor = {
      CreatePolicyStmt: (path) => { visited.push(`CreatePolicyStmt:${path.node.policy_name}`); },
      RoleSpec: (path) => { visited.push(`RoleSpec:${path.node.roletype}`); },
      A_Const: () => { visited.push('A_Const'); }
    };
    walk(createPolicyAst, visitor);
    expect(visited.sort()).toEqual([
      'A_Const',
      'CreatePolicyStmt:p',
      'RoleSpec:ROLESPEC_PUBLIC'
    ]);
  });
});

describe('visit — typed embedded fields (untagged)', () => {
  it('visits RangeVar for CreatePolicyStmt.table', () => {
    const visited: any[] = [];
    visit(createPolicyAst, {
      RangeVar: (node, ctx) => { visited.push({ node, ctx }); }
    });

    expect(visited).toHaveLength(1);
    expect(visited[0].node.relname).toBe('posts');
    expect(visited[0].ctx.path).toEqual(['table']);
  });

  it('visits RawStmt for the array-typed ParseResult.stmts field', () => {
    const parseResult = {
      ParseResult: {
        version: 180004,
        stmts: [{ stmt: indexStmtAst, stmt_len: 34 }]
      }
    };
    const rawStmts: any[] = [];
    const rangeVars: any[] = [];
    visit(parseResult, {
      RawStmt: (node) => { rawStmts.push(node); },
      RangeVar: (node) => { rangeVars.push(node); }
    });

    expect(rawStmts).toHaveLength(1);
    expect(rangeVars).toHaveLength(1);
    expect(rangeVars[0].relname).toBe('posts');
  });

  it('detects a bare libpg-query parse result at the root', () => {
    const parseResult = {
      version: 180004,
      stmts: [{ stmt: createPolicyAst, stmt_len: 52 }]
    };
    const visited: string[] = [];
    visit(parseResult, {
      ParseResult: () => { visited.push('ParseResult'); },
      RawStmt: () => { visited.push('RawStmt'); },
      RangeVar: (node) => { visited.push(`RangeVar:${node.relname}`); }
    });
    expect(visited).toEqual(['ParseResult', 'RawStmt', 'RangeVar:posts']);
  });

  it('keeps existing behavior for tagged nodes', () => {
    const visited: string[] = [];
    visit(createPolicyAst, {
      CreatePolicyStmt: (node) => { visited.push(`CreatePolicyStmt:${node.policy_name}`); },
      RoleSpec: (node) => { visited.push(`RoleSpec:${node.roletype}`); }
    });
    expect(visited).toEqual(['CreatePolicyStmt:p', 'RoleSpec:ROLESPEC_PUBLIC']);
  });
});
