# pgsql-deparser 

<p align="center" width="100%">
  <img height="120" src="https://github.com/constructive-io/pgsql-parser/assets/545047/6440fa7d-918b-4a3b-8d1b-755d85de8bea" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://www.npmjs.com/package/pgsql-deparser"><img height="20" src="https://img.shields.io/npm/dt/pgsql-deparser"></a>
   <a href="https://www.npmjs.com/package/pgsql-deparser"><img height="20" src="https://img.shields.io/npm/dw/pgsql-deparser"/></a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE-MIT"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
   <a href="https://www.npmjs.com/package/pgsql-deparser"><img height="20" src="https://img.shields.io/github/package-json/v/constructive-io/pgsql-parser?filename=packages%2Fdeparser%2Fpackage.json"/></a>
</p>

`pgsql-deparser` is the lightning-fast, pure TypeScript solution for converting PostgreSQL ASTs back into SQL queries. Perfect companion to [`pgsql-parser`](https://github.com/constructive-io/pgsql-parser), this focused tool delivers SQL generation without any native dependencies or WebAssembly overhead.

## Installation

```sh
npm install pgsql-deparser
```

## Features

* ⚡ **Pure TypeScript Performance** – Zero runtime dependencies, no WASM, no compilation - just blazing fast SQL generation
* 🪶 **Ultra Lightweight** – Minimal footprint with laser-focused functionality for AST-to-SQL conversion only
* 🧪 **Battle-Tested Reliability** – Validated against 23,000+ SQL statements ensuring production-grade stability
* 🌍 **Universal Compatibility** – Runs anywhere JavaScript does - browsers, Node.js, edge functions, you name it

## Deparser Example

The `pgsql-deparser` module serializes ASTs to SQL in pure TypeScript, avoiding the full parser's native dependencies. It's useful when only SQL string conversion from ASTs is needed, and is written in pure TypeScript for easy cross-environment deployment.

Here's how you can use the deparser in your TypeScript code, using [`@pgsql/utils`](https://github.com/constructive-io/pgsql-parser/tree/main/packages/utils) to create an AST for `deparse`:

```ts
import * as t from '@pgsql/utils';
import { RangeVar, SelectStmt } from '@pgsql/types';
import { deparseSync as deparse } from 'pgsql-deparser';

// This could have been obtained from any JSON or AST, not necessarily @pgsql/utils
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

// Modify the AST if needed  
(stmt.SelectStmt.fromClause[0] as {RangeVar: RangeVar}).RangeVar.relname = 'another_table';

// Deparse the modified AST back to a SQL string
console.log(deparse(stmt));

// Output: SELECT * FROM another_table
```

### Latest Version (PostgreSQL 17)

```sh
npm install pgsql-deparser
```

### Version-Specific Packages (PostgreSQL 13-16)

While we highly recommend using PG17, for PostgreSQL versions 13-16, use the version-specific packages:

```sh
npm install pgsql-deparser@pg13  # PostgreSQL 13
npm install pgsql-deparser@pg14  # PostgreSQL 14
npm install pgsql-deparser@pg15  # PostgreSQL 15
npm install pgsql-deparser@pg16  # PostgreSQL 16
```

**Version Status:**
- **PG17**: 🚀 Recommended (stable + modern AST)
- **PG14-16**: ⚠️ Experimental (modern AST, hardening in progress)
- **PG13**: Stable (legacy AST format)

## Options

The deparser accepts optional configuration for formatting and output control:

```ts
import { deparseSync as deparse } from 'pgsql-deparser';

const options = {
  pretty: true,           // Enable pretty formatting (default: true)
  newline: '\n',         // Newline character (default: '\n')
  tab: '  ',             // Tab/indentation character (default: '  ')
  semicolons: true       // Add semicolons to statements (default: true)
};

const sql = deparse(ast, options);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pretty` | `boolean` | `true` | Enable pretty formatting with indentation and line breaks |
| `newline` | `string` | `'\n'` | Character(s) used for line breaks |
| `tab` | `string` | `'  '` | Character(s) used for indentation |
| `semicolons` | `boolean` | `true` | Add semicolons to SQL statements |

**Pretty formatting example:**
```ts
// Without pretty formatting
const sql1 = deparse(selectAst, { pretty: false });
// "SELECT id, name FROM users WHERE active = true;"

// With pretty formatting  
const sql2 = deparse(selectAst, { pretty: true });
// SELECT
//   id,
//   name
// FROM users
// WHERE
//   active = true;
```

For complete documentation and advanced options, see [DEPARSER_USAGE.md](../../DEPARSER_USAGE.md).

## Why Use `pgsql-deparser`?

`pgsql-deparser` is particularly useful in development environments where native dependencies are problematic or in applications where only the deparser functionality is required. Its independence from the full `pgsql-parser` package allows for more focused and lightweight SQL generation tasks.

## Credits

Built on the excellent work of several contributors:

* **[Dan Lynch](https://github.com/pyramation)** — official maintainer since 2018 and architect of the current implementation
* **[Lukas Fittl](https://github.com/lfittl)** for [libpg_query](https://github.com/pganalyze/libpg_query) — the core PostgreSQL parser that powers this project
* **[Greg Richardson](https://github.com/gregnr)** for AST guidance and pushing the transition to WASM and multiple PG runtimes for better interoperability
* **[Ethan Resnick](https://github.com/ethanresnick)** for the original Node.js N-API bindings
* **[Zac McCormick](https://github.com/zhm)** for the foundational [node-pg-query-native](https://github.com/zhm/node-pg-query-native) parser