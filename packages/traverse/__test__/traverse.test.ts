import type { Visitor, Walker } from '../src';
import { NodePath, walk } from '../src';

describe('traverse', () => {
  it('should visit SelectStmt nodes with new walk API', () => {
    const selectStmtVisited: any[] = [];
    const rangeVarVisited: any[] = [];
    
    const visitor: Visitor = {
      SelectStmt: (path: NodePath) => {
        selectStmtVisited.push({ node: path.node, ctx: { path: path.path, parent: path.parent?.node, key: path.key } });
      },
      RangeVar: (path: NodePath) => {
        rangeVarVisited.push({ node: path.node, ctx: { path: path.path, parent: path.parent?.node, key: path.key } });
      }
    };

    const ast = {
      SelectStmt: {
        targetList: [
          {
            ResTarget: {
              val: {
                ColumnRef: {
                  fields: [{ A_Star: {} }]
                }
              }
            }
          }
        ],
        fromClause: [
          {
            RangeVar: {
              relname: 'users',
              inh: true,
              relpersistence: 'p'
            }
          }
        ],
        limitOption: 'LIMIT_OPTION_DEFAULT',
        op: 'SETOP_NONE'
      }
    };

    walk(ast, visitor);

    expect(selectStmtVisited).toHaveLength(1);
    expect(rangeVarVisited).toHaveLength(1);
    expect(rangeVarVisited[0].node.relname).toBe('users');
  });

  it('should provide NodePath with correct properties', () => {
    const paths: NodePath[] = [];
    
    const walker: Walker = (path: NodePath) => {
      paths.push(path);
    };

    const ast = {
      SelectStmt: {
        fromClause: [
          {
            RangeVar: {
              relname: 'users',
              inh: true,
              relpersistence: 'p'
            }
          }
        ]
      }
    };

    walk(ast, walker);

    const selectPath = paths.find(p => p.tag === 'SelectStmt');
    const rangeVarPath = paths.find(p => p.tag === 'RangeVar');

    expect(selectPath).toBeDefined();
    expect(selectPath!.tag).toBe('SelectStmt');
    expect(selectPath!.parent).toBeNull();
    expect(selectPath!.path).toEqual([]);

    expect(rangeVarPath).toBeDefined();
    expect(rangeVarPath!.tag).toBe('RangeVar');
    expect(rangeVarPath!.parent).toBe(selectPath);
    expect(rangeVarPath!.path).toEqual(['fromClause', 0]);
    expect(rangeVarPath!.key).toBe(0);
  });

  it('should support early return to skip subtrees', () => {
    const visitedNodes: string[] = [];
    
    const walker: Walker = (path: NodePath) => {
      visitedNodes.push(path.tag);
      
      if (path.tag === 'SelectStmt') {
        return false;
      }
    };

    const ast = {
      SelectStmt: {
        fromClause: [
          {
            RangeVar: {
              relname: 'users',
              inh: true,
              relpersistence: 'p'
            }
          }
        ]
      }
    };

    walk(ast, walker);

    expect(visitedNodes).toEqual(['SelectStmt']);
    expect(visitedNodes).not.toContain('RangeVar');
  });

  it('should use runtime schema for precise traversal', () => {
    const visitedNodes: string[] = [];
    
    const visitor: Visitor = {
      A_Expr: (_path: NodePath) => {
        visitedNodes.push('A_Expr');
      },
      ColumnRef: (_path: NodePath) => {
        visitedNodes.push('ColumnRef');
      },
      A_Const: (_path: NodePath) => {
        visitedNodes.push('A_Const');
      }
    };

    const ast = {
      A_Expr: {
        kind: 'AEXPR_OP',
        name: [{ String: { sval: '=' } }],
        lexpr: {
          ColumnRef: {
            fields: [{ String: { sval: 'id' } }]
          }
        },
        rexpr: {
          A_Const: {
            ival: { Integer: { ival: 1 } }
          }
        }
      }
    };

    walk(ast, visitor);

    expect(visitedNodes).toContain('A_Expr');
    expect(visitedNodes).toContain('ColumnRef');
    expect(visitedNodes).toContain('A_Const');
  });

  it('should dispatch a visitor object per node tag', () => {
    const selectStmtVisited: any[] = [];
    const rangeVarVisited: any[] = [];

    const visitor: Visitor = {
      SelectStmt: (path: NodePath) => {
        selectStmtVisited.push(path);
      },
      RangeVar: (path: NodePath) => {
        rangeVarVisited.push(path);
      }
    };

    const ast = {
      SelectStmt: {
        fromClause: [
          {
            RangeVar: {
              relname: 'users',
              inh: true,
              relpersistence: 'p'
            }
          }
        ]
      }
    };

    walk(ast, visitor);

    expect(selectStmtVisited).toHaveLength(1);
    expect(rangeVarVisited).toHaveLength(1);
    expect(rangeVarVisited[0].node.relname).toBe('users');
  });

  it('should handle ParseResult nodes', () => {
    const parseResultVisited: any[] = [];
    const rawStmtVisited: any[] = [];
    const selectStmtVisited: any[] = [];
    
    const visitor: Visitor = {
      ParseResult: (path: NodePath) => {
        parseResultVisited.push(path);
      },
      RawStmt: (path: NodePath) => {
        rawStmtVisited.push(path);
      },
      SelectStmt: (path: NodePath) => {
        selectStmtVisited.push(path);
      }
    };

    const parseResult = {
      ParseResult: {
        version: 170004,
        stmts: [
          {
            RawStmt: {
              stmt: {
                SelectStmt: {
                  targetList: [] as any[],
                  limitOption: 'LIMIT_OPTION_DEFAULT',
                  op: 'SETOP_NONE'
                }
              }
            }
          }
        ]
      }
    };

    walk(parseResult, visitor);

    expect(parseResultVisited).toHaveLength(1);
    expect(rawStmtVisited).toHaveLength(1);
    expect(selectStmtVisited).toHaveLength(1);
    expect(parseResultVisited[0].node.version).toBe(170004);
    expect(rawStmtVisited[0].node.stmt).toBeDefined();
    expect(selectStmtVisited[0].node.limitOption).toBe('LIMIT_OPTION_DEFAULT');
  });

  it('should provide the key path of each node', () => {
    const paths: NodePath[] = [];

    const visitor: Visitor = {
      RangeVar: (path: NodePath) => {
        paths.push(path);
      }
    };

    const ast = {
      SelectStmt: {
        fromClause: [
          {
            RangeVar: {
              relname: 'users',
              inh: true,
              relpersistence: 'p'
            }
          }
        ]
      }
    };

    walk(ast, visitor);

    expect(paths).toHaveLength(1);
    expect(paths[0].path).toEqual(['fromClause', 0]);
    expect(paths[0].key).toBe(0);
  });

  it('should handle null and undefined nodes gracefully', () => {
    const visitor = {
      SelectStmt: () => {
        throw new Error('Should not be called');
      }
    };

    expect(() => walk(null as any, visitor)).not.toThrow();
    expect(() => walk(undefined as any, visitor)).not.toThrow();
    expect(() => walk('string' as any, visitor)).not.toThrow();
  });

  it('should handle nested complex AST structures', () => {
    const visitedNodes: string[] = [];
    
    const visitor: Visitor = {
      SelectStmt: () => { visitedNodes.push('SelectStmt'); },
      ResTarget: () => { visitedNodes.push('ResTarget'); },
      ColumnRef: () => { visitedNodes.push('ColumnRef'); },
      A_Star: () => { visitedNodes.push('A_Star'); },
      RangeVar: () => { visitedNodes.push('RangeVar'); },
      A_Expr: () => { visitedNodes.push('A_Expr'); },
      A_Const: () => { visitedNodes.push('A_Const'); }
    };

    const complexAst = {
      SelectStmt: {
        targetList: [
          {
            ResTarget: {
              val: {
                ColumnRef: {
                  fields: [{ A_Star: {} }]
                }
              }
            }
          }
        ],
        fromClause: [
          {
            RangeVar: {
              relname: 'users',
              inh: true,
              relpersistence: 'p'
            }
          }
        ],
        whereClause: {
          A_Expr: {
            kind: 'AEXPR_OP',
            name: [{ String: { sval: '=' } }],
            lexpr: {
              ColumnRef: {
                fields: [{ String: { sval: 'id' } }]
              }
            },
            rexpr: {
              A_Const: {
                ival: { Integer: { ival: 1 } }
              }
            }
          }
        },
        limitOption: 'LIMIT_OPTION_DEFAULT',
        op: 'SETOP_NONE'
      }
    };

    walk(complexAst, visitor);

    expect(visitedNodes).toContain('SelectStmt');
    expect(visitedNodes).toContain('ResTarget');
    expect(visitedNodes).toContain('ColumnRef');
    expect(visitedNodes).toContain('A_Star');
    expect(visitedNodes).toContain('RangeVar');
    expect(visitedNodes).toContain('A_Expr');
    expect(visitedNodes).toContain('A_Const');
  });

  it('should handle arrays of nodes correctly', () => {
    const targetListVisited: any[] = [];
    
    const visitor: Visitor = {
      ResTarget: (path: NodePath) => {
        targetListVisited.push(path);
      }
    };

    const ast = {
      SelectStmt: {
        targetList: [
          {
            ResTarget: {
              val: {
                ColumnRef: {
                  fields: [{ String: { sval: 'name' } }]
                }
              }
            }
          },
          {
            ResTarget: {
              val: {
                ColumnRef: {
                  fields: [{ String: { sval: 'email' } }]
                }
              }
            }
          }
        ],
        limitOption: 'LIMIT_OPTION_DEFAULT',
        op: 'SETOP_NONE'
      }
    };

    walk(ast, visitor);

    expect(targetListVisited).toHaveLength(2);
    expect(targetListVisited[0].key).toBe(0);
    expect(targetListVisited[1].key).toBe(1);
    expect(targetListVisited[0].path).toEqual(['targetList', 0]);
    expect(targetListVisited[1].path).toEqual(['targetList', 1]);
  });

  it('should traverse WithClause nodes', () => {
    const visitedNodes: string[] = [];
    
    const walker: Walker = (path: NodePath) => {
      visitedNodes.push(path.tag);
    };

    const ast = {
      SelectStmt: {
        withClause: {
          WithClause: {
            ctes: [
              {
                CommonTableExpr: {
                  ctename: 'cte1',
                  ctequery: {
                    SelectStmt: {
                      targetList: [] as any[],
                      limitOption: 'LIMIT_OPTION_DEFAULT',
                      op: 'SETOP_NONE'
                    }
                  }
                }
              }
            ]
          }
        },
        targetList: [] as any[],
        limitOption: 'LIMIT_OPTION_DEFAULT',
        op: 'SETOP_NONE'
      }
    };

    walk(ast, walker);

    expect(visitedNodes).toContain('SelectStmt');
    expect(visitedNodes).toContain('WithClause');
    expect(visitedNodes).toContain('CommonTableExpr');
    expect(visitedNodes.filter(n => n === 'SelectStmt')).toHaveLength(2);
  });

  it('should traverse union larg and rarg nodes', () => {
    const visitedNodes: string[] = [];
    
    const walker: Walker = (path: NodePath) => {
      visitedNodes.push(path.tag);
    };

    const ast = {
      SelectStmt: {
        larg: {
          SelectStmt: {
            targetList: [
              {
                ResTarget: {
                  val: {
                    A_Const: {
                      ival: { Integer: { ival: 1 } }
                    }
                  }
                }
              }
            ],
            limitOption: 'LIMIT_OPTION_DEFAULT',
            op: 'SETOP_NONE'
          }
        },
        op: 'SETOP_UNION',
        rarg: {
          SelectStmt: {
            targetList: [
              {
                ResTarget: {
                  val: {
                    A_Const: {
                      ival: { Integer: { ival: 2 } }
                    }
                  }
                }
              }
            ],
            limitOption: 'LIMIT_OPTION_DEFAULT',
            op: 'SETOP_NONE'
          }
        }
      }
    };

    walk(ast, walker);

    expect(visitedNodes).toContain('SelectStmt');
    expect(visitedNodes.filter(n => n === 'SelectStmt')).toHaveLength(3);
    expect(visitedNodes).toContain('ResTarget');
    expect(visitedNodes).toContain('A_Const');
  });
});
