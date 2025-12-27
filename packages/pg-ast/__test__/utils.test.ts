import * as t from '../src';
import { RangeVar, SelectStmt } from '@pgsql/types';
import { deparseSync as deparse } from 'pgsql-deparser';

it('simple SelectStmt', () => {
  const stmt: { SelectStmt: SelectStmt } = t.nodes.selectStmt({
    targetList: [
      t.nodes.resTarget({
        val: t.nodes.columnRef({
          fields: [t.nodes.aStar()]
        })
      })
    ],
    fromClause: [
      t.nodes.rangeVar({
        relname: 'some_table',
        inh: true,
        relpersistence: 'p'
      })
    ],
    limitOption: 'LIMIT_OPTION_DEFAULT',
    op: 'SETOP_NONE'
  });
  
  (stmt.SelectStmt.fromClause[0] as {RangeVar: RangeVar}).RangeVar.relname = 'another_table';

  expect(stmt).toMatchSnapshot();
  expect(deparse(stmt, { pretty: false })).toMatchSnapshot();
});

it('SelectStmt with WHERE clause', () => {
  const selectStmt: { SelectStmt: SelectStmt } = t.nodes.selectStmt({
    targetList: [
      t.nodes.resTarget({
        val: t.nodes.columnRef({
          fields: [t.nodes.aStar()]
        })
      })
    ],
    fromClause: [
      t.nodes.rangeVar({
        schemaname: 'myschema',
        relname: 'mytable',
        inh: true,
        relpersistence: 'p'
      })
    ],
    whereClause: t.nodes.aExpr({
      kind: 'AEXPR_OP',
      name: [t.nodes.string({ sval: '=' })],
      lexpr: t.nodes.columnRef({
        fields: [t.nodes.string({ sval: 'a' })]
      }),
      rexpr: t.nodes.typeCast({
        arg: t.nodes.aConst({
          sval: t.ast.string({ sval: 't' })
        }),
        typeName: t.ast.typeName({
          names: [
            t.nodes.string({ sval: 'pg_catalog' }),
            t.nodes.string({ sval: 'bool' })
          ],
          typemod: -1
        })
      })
    }),
    limitOption: 'LIMIT_OPTION_DEFAULT',
    op: 'SETOP_NONE'
  });
  
  expect(deparse(selectStmt, { pretty: false })).toEqual(`SELECT * FROM myschema.mytable WHERE a = CAST('t' AS boolean)`);
});

it('queries', () => {
  const query: { SelectStmt: SelectStmt } = t.nodes.selectStmt({
    targetList: [
      t.nodes.resTarget({
        val: t.nodes.columnRef({
          fields: [t.nodes.string({ sval: 'name' })]
        })
      }),
      t.nodes.resTarget({
        val: t.nodes.columnRef({
          fields: [t.nodes.string({ sval: 'email' })]
        })
      })
    ],
    fromClause: [
      t.nodes.rangeVar({
        relname: 'users',
        inh: true,
        relpersistence: 'p'
      })
    ],
    whereClause: t.nodes.aExpr({
      kind: 'AEXPR_OP',
      name: [t.nodes.string({ sval: '>' })],
      lexpr: t.nodes.columnRef({
        fields: [t.nodes.string({ sval: 'age' })]
      }),
      rexpr: t.nodes.aConst({
        ival: t.ast.integer({ ival: 18 })
      })
    }),
    limitOption: 'LIMIT_OPTION_DEFAULT',
    op: 'SETOP_NONE'
  });

  expect(deparse(query, { pretty: false })).toEqual(`SELECT name, email FROM users WHERE age > 18`);
  
});
it('dynamic creation of tables', () => {
  // Example JSON schema
  const schema = {
    "tableName": "users",
    "columns": [
      { "name": "id", "type": "int", "constraints": ["PRIMARY KEY"] },
      { "name": "username", "type": "text" },
      { "name": "email", "type": "text", "constraints": ["UNIQUE"] },
      { "name": "created_at", "type": "timestamp", "constraints": ["NOT NULL"] }
    ]
  };

  // Construct the CREATE TABLE statement
  const createStmt = t.nodes.createStmt({
    relation: t.ast.rangeVar({ 
      relname: schema.tableName,
      inh: true,
      relpersistence: 'p'
    }),
    tableElts: schema.columns.map(column => t.nodes.columnDef({
      colname: column.name,
      typeName: t.ast.typeName({
        names: [t.nodes.string({ sval: column.type })]
      }),
      constraints: column.constraints?.map(constraint =>
        t.nodes.constraint({
          contype: constraint === "PRIMARY KEY" ? "CONSTR_PRIMARY" : constraint === "UNIQUE" ? "CONSTR_UNIQUE" : "CONSTR_NOTNULL"
        })
      )
    }))
  });

  // `deparse` function converts AST to SQL string
  const sql = deparse(createStmt, { pretty: false });
  expect(sql).toMatchSnapshot();
})
