import generate from '@babel/generator';
import { SelectStmt } from '@pgsql/types';

import { generateTsAstCodeFromPgAst } from '../src/utils';
import * as t from '../test-utils/meta';
import { runtimeSchema } from '../test-utils/meta/runtime-schema';

it('AST to AST to create AST — meta 🤯', () => {
  const selectStmt = t.nodes.selectStmt({
    targetList: [
      t.nodes.resTarget({
        val: t.nodes.columnRef({
          fields: [t.nodes.aStar()]
        })
      })
    ],
    fromClause: [
      t.nodes.rangeVar({
        relname: 'some_amazing_table',
        inh: true,
        relpersistence: 'p'
      })
    ],
    limitOption: 'LIMIT_OPTION_DEFAULT',
    op: 'SETOP_NONE'
  });

  const astForAst = generateTsAstCodeFromPgAst(selectStmt, runtimeSchema);
  expect(generate(astForAst).code).toMatchSnapshot();
});

it('Complex AST — Advanced SQL with CTEs, Window Functions, Joins, and Subqueries', () => {
  const complexSelectStmt: { SelectStmt: SelectStmt } = t.nodes.selectStmt({
    // WITH clause for CTEs
    withClause: t.ast.withClause({
      ctes: [
        // First CTE: Sales summary
        t.nodes.commonTableExpr({
          ctename: 'sales_summary',
          ctequery: t.nodes.selectStmt({
            targetList: [
              t.nodes.resTarget({
                name: 'customer_id',
                val: t.nodes.columnRef({
                  fields: [t.nodes.string({ sval: 'customer_id' })]
                })
              }),
              t.nodes.resTarget({
                name: 'total_sales',
                val: t.nodes.funcCall({
                  funcname: [t.nodes.string({ sval: 'sum' })],
                  args: [
                    t.nodes.columnRef({
                      fields: [t.nodes.string({ sval: 'amount' })]
                    })
                  ]
                })
              }),
              t.nodes.resTarget({
                name: 'avg_order_value',
                val: t.nodes.funcCall({
                  funcname: [t.nodes.string({ sval: 'avg' })],
                  args: [
                    t.nodes.columnRef({
                      fields: [t.nodes.string({ sval: 'amount' })]
                    })
                  ]
                })
              })
            ],
            fromClause: [
              t.nodes.rangeVar({
                relname: 'orders',
                inh: true,
                relpersistence: 'p'
              })
            ],
            whereClause: t.nodes.aExpr({
              kind: 'AEXPR_OP',
              name: [t.nodes.string({ sval: '>=' })],
              lexpr: t.nodes.columnRef({
                fields: [t.nodes.string({ sval: 'order_date' })]
              }),
              rexpr: t.nodes.aConst({
                sval: t.ast.string({ sval: '2023-01-01' })
              })
            }),
            groupClause: [
              t.nodes.columnRef({
                fields: [t.nodes.string({ sval: 'customer_id' })]
              })
            ],
            limitOption: 'LIMIT_OPTION_DEFAULT',
            op: 'SETOP_NONE'
          })
        }),
        t.nodes.commonTableExpr({
          ctename: 'customer_rankings',
          ctequery: t.nodes.selectStmt({
            targetList: [
              t.nodes.resTarget({
                name: 'customer_id',
                val: t.nodes.columnRef({
                  fields: [t.nodes.string({ sval: 'customer_id' })]
                })
              }),
              t.nodes.resTarget({
                name: 'total_sales',
                val: t.nodes.columnRef({
                  fields: [t.nodes.string({ sval: 'total_sales' })]
                })
              }),
              t.nodes.resTarget({
                name: 'sales_rank',
                val: t.nodes.windowFunc({
                  winfnoid: 3133, // ROW_NUMBER function OID
                  wintype: 20, // INT8 type
                  args: [],
                  winref: 1,
                  winstar: false,
                  winagg: false
                })
              }),
              t.nodes.resTarget({
                name: 'sales_percentile',
                val: t.nodes.windowFunc({
                  winfnoid: 3974, // PERCENT_RANK function OID  
                  wintype: 701, // FLOAT8 type
                  args: [],
                  winref: 2,
                  winstar: false,
                  winagg: false
                })
              })
            ],
            fromClause: [
              t.nodes.rangeVar({
                relname: 'sales_summary',
                inh: true,
                relpersistence: 'p'
              })
            ],
            windowClause: [
              t.nodes.windowDef({
                name: 'sales_window',
                orderClause: [
                  t.nodes.sortBy({
                    node: t.nodes.columnRef({
                      fields: [t.nodes.string({ sval: 'total_sales' })]
                    }),
                    sortby_dir: 'SORTBY_DESC',
                    sortby_nulls: 'SORTBY_NULLS_DEFAULT'
                  })
                ]
              })
            ],
            limitOption: 'LIMIT_OPTION_DEFAULT',
            op: 'SETOP_NONE'
          })
        })
      ],
      recursive: false
    }),
      
    // Main SELECT target list with complex expressions
    targetList: [
      t.nodes.resTarget({
        name: 'customer_name',
        val: t.nodes.columnRef({
          fields: [t.nodes.string({ sval: 'c' }), t.nodes.string({ sval: 'name' })]
        })
      }),
      t.nodes.resTarget({
        name: 'total_sales',
        val: t.nodes.columnRef({
          fields: [t.nodes.string({ sval: 'cr' }), t.nodes.string({ sval: 'total_sales' })]
        })
      }),
      t.nodes.resTarget({
        name: 'sales_rank',
        val: t.nodes.columnRef({
          fields: [t.nodes.string({ sval: 'cr' }), t.nodes.string({ sval: 'sales_rank' })]
        })
      }),
      t.nodes.resTarget({
        name: 'customer_tier',
        val: t.nodes.caseExpr({
          args: [
            t.nodes.caseWhen({
              expr: t.nodes.aExpr({
                kind: 'AEXPR_OP',
                name: [t.nodes.string({ sval: '<=' })],
                lexpr: t.nodes.columnRef({
                  fields: [t.nodes.string({ sval: 'cr' }), t.nodes.string({ sval: 'sales_rank' })]
                }),
                rexpr: t.nodes.aConst({
                  ival: t.ast.integer({ ival: 10 })
                })
              }),
              result: t.nodes.aConst({
                sval: t.ast.string({ sval: 'Premium' })
              })
            }),
            t.nodes.caseWhen({
              expr: t.nodes.aExpr({
                kind: 'AEXPR_OP',
                name: [t.nodes.string({ sval: '<=' })],
                lexpr: t.nodes.columnRef({
                  fields: [t.nodes.string({ sval: 'cr' }), t.nodes.string({ sval: 'sales_rank' })]
                }),
                rexpr: t.nodes.aConst({
                  ival: t.ast.integer({ ival: 50 })
                })
              }),
              result: t.nodes.aConst({
                sval: t.ast.string({ sval: 'Gold' })
              })
            }),
            t.nodes.caseWhen({
              expr: t.nodes.aExpr({
                kind: 'AEXPR_OP',
                name: [t.nodes.string({ sval: '<=' })],
                lexpr: t.nodes.columnRef({
                  fields: [t.nodes.string({ sval: 'cr' }), t.nodes.string({ sval: 'sales_rank' })]
                }),
                rexpr: t.nodes.aConst({
                  ival: t.ast.integer({ ival: 100 })
                })
              }),
              result: t.nodes.aConst({
                sval: t.ast.string({ sval: 'Silver' })
              })
            })
          ],
          defresult: t.nodes.aConst({
            sval: t.ast.string({ sval: 'Bronze' })
          })
        })
      }),
      t.nodes.resTarget({
        name: 'recent_order_count',
        val: t.nodes.subLink({
          subLinkType: 'EXPR_SUBLINK',
          subselect: t.nodes.selectStmt({
            targetList: [
              t.nodes.resTarget({
                val: t.nodes.funcCall({
                  funcname: [t.nodes.string({ sval: 'count' })],
                  args: [t.nodes.aStar()]
                })
              })
            ],
            fromClause: [
              t.nodes.rangeVar({
                relname: 'orders',
                alias: t.ast.alias({ aliasname: 'o2' }),
                inh: true,
                relpersistence: 'p'
              })
            ],
            whereClause: t.nodes.boolExpr({
              boolop: 'AND_EXPR',
              args: [
                t.nodes.aExpr({
                  kind: 'AEXPR_OP',
                  name: [t.nodes.string({ sval: '=' })],
                  lexpr: t.nodes.columnRef({
                    fields: [t.nodes.string({ sval: 'o2' }), t.nodes.string({ sval: 'customer_id' })]
                  }),
                  rexpr: t.nodes.columnRef({
                    fields: [t.nodes.string({ sval: 'c' }), t.nodes.string({ sval: 'id' })]
                  })
                }),
                t.nodes.aExpr({
                  kind: 'AEXPR_OP',
                  name: [t.nodes.string({ sval: '>=' })],
                  lexpr: t.nodes.columnRef({
                    fields: [t.nodes.string({ sval: 'o2' }), t.nodes.string({ sval: 'order_date' })]
                  }),
                  rexpr: t.nodes.funcCall({
                    funcname: [t.nodes.string({ sval: 'current_date' })],
                    args: []
                  })
                })
              ]
            }),
            limitOption: 'LIMIT_OPTION_DEFAULT',
            op: 'SETOP_NONE'
          })
        })
      })
    ],
      
    // Complex FROM clause with joins
    fromClause: [
      t.nodes.joinExpr({
        jointype: 'JOIN_INNER',
        larg: t.nodes.rangeVar({
          relname: 'customers',
          alias: t.ast.alias({ aliasname: 'c' }),
          inh: true,
          relpersistence: 'p'
        }),
        rarg: t.nodes.rangeVar({
          relname: 'customer_rankings',
          alias: t.ast.alias({ aliasname: 'cr' }),
          inh: true,
          relpersistence: 'p'
        }),
        quals: t.nodes.aExpr({
          kind: 'AEXPR_OP',
          name: [t.nodes.string({ sval: '=' })],
          lexpr: t.nodes.columnRef({
            fields: [t.nodes.string({ sval: 'c' }), t.nodes.string({ sval: 'id' })]
          }),
          rexpr: t.nodes.columnRef({
            fields: [t.nodes.string({ sval: 'cr' }), t.nodes.string({ sval: 'customer_id' })]
          })
        })
      })
    ],
      
    // WHERE clause with complex conditions
    whereClause: t.nodes.boolExpr({
      boolop: 'AND_EXPR',
      args: [
        t.nodes.aExpr({
          kind: 'AEXPR_OP',
          name: [t.nodes.string({ sval: '>' })],
          lexpr: t.nodes.columnRef({
            fields: [t.nodes.string({ sval: 'cr' }), t.nodes.string({ sval: 'total_sales' })]
          }),
          rexpr: t.nodes.aConst({
            ival: t.ast.integer({ ival: 1000 })
          })
        }),
        t.nodes.aExpr({
          kind: 'AEXPR_OP',
          name: [t.nodes.string({ sval: 'IS NOT' })],
          lexpr: t.nodes.columnRef({
            fields: [t.nodes.string({ sval: 'c' }), t.nodes.string({ sval: 'status' })]
          }),
          rexpr: t.nodes.aConst({
            sval: t.ast.string({ sval: 'inactive' })
          })
        })
      ]
    }),
      
    // ORDER BY clause
    sortClause: [
      t.nodes.sortBy({
        node: t.nodes.columnRef({
          fields: [t.nodes.string({ sval: 'cr' }), t.nodes.string({ sval: 'sales_rank' })]
        }),
        sortby_dir: 'SORTBY_ASC',
        sortby_nulls: 'SORTBY_NULLS_DEFAULT'
      })
    ],
      
    // LIMIT clause
    limitCount: t.nodes.aConst({
      ival: t.ast.integer({ ival: 50 })
    }),
      
    limitOption: 'LIMIT_OPTION_COUNT',
    op: 'SETOP_NONE'
  });
    
  const astForComplexAst = generateTsAstCodeFromPgAst(complexSelectStmt, runtimeSchema);
  expect(generate(astForComplexAst).code).toMatchSnapshot();
});

it('Enhanced AST generation with runtime schema — wrapped vs unwrapped nodes', () => {
  const selectStmt = t.nodes.selectStmt({
    targetList: [
      t.nodes.resTarget({
        val: t.nodes.columnRef({
          fields: [t.nodes.aStar()]
        })
      })
    ],
    fromClause: [
      t.nodes.rangeVar({
        relname: 'test_table',
        inh: true,
        relpersistence: 'p'
      })
    ],
    limitOption: 'LIMIT_OPTION_DEFAULT',
    op: 'SETOP_NONE'
  });

  const enhancedAst = generateTsAstCodeFromPgAst(selectStmt, runtimeSchema);
  const generatedCode = generate(enhancedAst).code;
    
  expect(generatedCode).toMatchSnapshot();
    
  expect(generatedCode).toContain('t.nodes.selectStmt');
  expect(generatedCode).toContain('t.nodes.resTarget');
});

it('Complex AST with runtime schema — mixed wrapped/unwrapped patterns', () => {
  const complexStmt = t.nodes.selectStmt({
    withClause: t.ast.withClause({
      ctes: [
        t.nodes.commonTableExpr({
          ctename: 'test_cte',
          ctequery: t.nodes.selectStmt({
            targetList: [
              t.nodes.resTarget({
                val: t.nodes.columnRef({
                  fields: [t.nodes.string({ sval: 'id' })]
                })
              })
            ],
            limitOption: 'LIMIT_OPTION_DEFAULT'
          })
        })
      ],
      recursive: false
    }),
    targetList: [
      t.nodes.resTarget({
        val: t.nodes.columnRef({
          fields: [t.nodes.aStar()]
        })
      })
    ],
    limitOption: 'LIMIT_OPTION_DEFAULT',
    op: 'SETOP_NONE'
  });

  const enhancedAst = generateTsAstCodeFromPgAst(complexStmt, runtimeSchema);
  const generatedCode = generate(enhancedAst).code;
    
  expect(generatedCode).toMatchSnapshot();
  expect(generatedCode).toContain('t.ast.withClause');
  expect(generatedCode).toContain('t.nodes.selectStmt');
});
