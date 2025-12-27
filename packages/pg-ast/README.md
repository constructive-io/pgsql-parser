# pg-ast

<p align="center" width="100%">
  <img height="120" src="https://github.com/constructive-io/pgsql-parser/assets/545047/6440fa7d-918b-4a3b-8d1b-755d85de8bea" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE-MIT"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
   <a href="https://www.npmjs.com/package/pg-ast"><img height="20" src="https://img.shields.io/github/package-json/v/constructive-io/pgsql-parser?filename=packages%2Fpg-ast%2Fpackage.json"/></a>
</p>

`pg-ast` is a utility library for `@pgsql/types`, offering convenient functions to work with PostgreSQL Abstract Syntax Tree (AST) nodes in a type-safe manner. This library facilitates the creation of AST nodes for building SQL queries or statements programmatically.

> **Note**: If you need the runtime schema for AST introspection, use [`@pgsql/utils`](https://www.npmjs.com/package/@pgsql/utils) instead.

# Table of Contents

1. [pg-ast](#pg-ast)
   - [Features](#features)
2. [Installation](#installation)
3. [Usage](#usage)
   - [AST Node Creation](#ast-node-creation)
     - [JSON AST](#json-ast)
     - [Select Statement](#select-statement)
     - [Creating Table Schemas Dynamically](#creating-table-schemas-dynamically)
4. [Related Projects](#related)
5. [Disclaimer](#disclaimer)

## Features

- **AST Node Creation**: Simplifies the process of constructing PostgreSQL AST nodes, allowing for easy assembly of SQL queries or statements programmatically.
- **Comprehensive Coverage**: Supports all node types defined in the PostgreSQL AST.
- **Seamless Integration**: Designed to be used alongside the `@pgsql/types` package for a complete AST handling solution.

## Installation

To add `pg-ast` to your project, use the following npm command:

```bash
npm install pg-ast
```

## Usage

### AST Node Creation

With the AST helper methods, creating complex SQL ASTs becomes straightforward and intuitive.

#### JSON AST

Explore the PostgreSQL Abstract Syntax Tree (AST) as JSON objects with ease using `pg-ast`. Below is an example of how you can generate a JSON AST using TypeScript:

```ts
import * as t from 'pg-ast';
import { SelectStmt } from '@pgsql/types';
import { deparse } from 'pgsql-deparser';

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
      relname: 'some_amazing_table',
      inh: true,
      relpersistence: 'p'
    })
  ],
  limitOption: 'LIMIT_OPTION_DEFAULT',
  op: 'SETOP_NONE'
});
console.log(selectStmt);
// Output: { "SelectStmt": { "targetList": [ { "ResTarget": { "val": { "ColumnRef": { "fields": [ { "A_Star": {} } ] } } } } ], "fromClause": [ { "RangeVar": { "relname": "some_amazing_table", "inh": true, "relpersistence": "p" } } ], "limitOption": "LIMIT_OPTION_DEFAULT", "op": "SETOP_NONE" } }
console.log(await deparse(stmt))
// Output: SELECT * FROM some_amazing_table
```

#### Select Statement

```ts
import * as t from 'pg-ast';
import { SelectStmt } from '@pgsql/types';
import { deparse } from 'pgsql-deparser';

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

await deparse(createStmt);
// SELECT name, email FROM users WHERE age > 18
```

#### Creating Table Schemas Dynamically

```ts
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
const sql = await deparse(createStmt, { pretty: true });

console.log(sql);
// OUTPUT: 

// CREATE TABLE users (
//  id int PRIMARY KEY,
// 	username text,
// 	email text UNIQUE,
// 	created_at timestamp NOT NULL 
// )
```
