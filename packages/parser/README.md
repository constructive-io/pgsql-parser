# pgsql-parser 

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://www.npmjs.com/package/pgsql-parser"><img height="20" src="https://img.shields.io/npm/dt/pgsql-parser"></a>
   <a href="https://www.npmjs.com/package/pgsql-parser"><img height="20" src="https://img.shields.io/npm/dw/pgsql-parser"/></a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE-MIT"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
   <a href="https://www.npmjs.com/package/pgsql-parser"><img height="20" src="https://img.shields.io/github/package-json/v/constructive-io/pgsql-parser?filename=packages%2Fparser%2Fpackage.json"/></a>
</p>

The real PostgreSQL parser for Node.js. Built with the actual [PostgreSQL parser](https://github.com/pganalyze/libpg_query), `pgsql-parser` delivers true-to-spec SQL parsing and reconstruction. Transform SQL queries into ASTs, modify them programmatically, and convert them back to SQL with complete fidelity.

## Installation

```sh
npm install pgsql-parser
```

## Features

* 🔄 **Symmetric Parsing & Deparsing** – Parse SQL to AST and reconstruct it back to SQL with perfect round-trip accuracy
* 🧪 **Battle-Tested Reliability** – Validated against 23,000+ SQL statements ensuring production-grade stability  
* 🔧 **Direct from PostgreSQL** – Uses the official Postgres C parser compiled to WebAssembly for 100% spec compliance
* 🚀 **WebAssembly Powered:** - Cross-platform compatibility without native dependencies.
* 🛠️ **AST Manipulation:** - Easily modify parts of a SQL statement through the AST.

## API

The package exports both async and sync methods. Async methods handle initialization automatically, while sync methods require explicit initialization.

⚠️ If you don't need the parser functionality, consider using the TS-only (no WASM, zero runtime dependencies) [`pgsql-deparser`](https://github.com/constructive-io/pgsql-parser/tree/main/packages/deparser) for a super fast, lightweight deparser. Battle-tested with 23,000+ SQL statements 🚀

### Async Methods (Recommended)

```typescript
import { parse, deparse } from 'pgsql-parser';

// Parse SQL to AST
const stmts = await parse('SELECT * FROM test_table');

// Deparse AST back to SQL
const sql = await deparse(stmts);
```

### Sync Methods

Sync methods require explicit initialization using `loadModule()`:

```typescript
import { loadModule, parseSync, deparseSync } from 'pgsql-parser';

// Initialize first (required for sync methods)
await loadModule();

// Now safe to use sync methods
const stmts = parseSync('SELECT * FROM test_table');
const sql = deparseSync(stmts);
```

**Note:** We recommend using async methods as they handle initialization automatically. Use sync methods only when necessary, and always call `loadModule()` first.

## Parser Example

Rewrite part of a SQL query:

```js
import { parse, deparse } from 'pgsql-parser';

const stmts = await parse('SELECT * FROM test_table');

// Assuming the structure of stmts is known and matches the expected type
stmts[0].RawStmt.stmt.SelectStmt.fromClause[0].RangeVar.relname = 'another_table';

console.log(await deparse(stmts));

// SELECT * FROM "another_table"
```

## Deparser Example

The `pgsql-deparser` module serializes ASTs to SQL in pure TypeScript, avoiding the full parser's native dependencies. It's useful when only SQL string conversion from ASTs is needed, and is written in pure TypeScript for easy cross-environment deployment.

Here's how you can use the deparser in your TypeScript code, using [`@pgsql/utils`](https://github.com/constructive-io/pgsql-parser/tree/main/packages/utils) to create an AST for `deparse`:

```ts
import * as t from '@pgsql/utils';
import { RangeVar, SelectStmt } from '@pgsql/types';
import { deparse } from 'pgsql-deparser';

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
console.log(await deparse(stmt));

// Output: SELECT * FROM another_table
```

## Credits

Built on the excellent work of several contributors:

* **[Dan Lynch](https://github.com/pyramation)** — official maintainer since 2018 and architect of the current implementation
* **[Lukas Fittl](https://github.com/lfittl)** for [libpg_query](https://github.com/pganalyze/libpg_query) — the core PostgreSQL parser that powers this project
* **[Greg Richardson](https://github.com/gregnr)** for AST guidance and pushing the transition to WASM and multiple PG runtimes for better interoperability
* **[Ethan Resnick](https://github.com/ethanresnick)** for the original Node.js N-API bindings
* **[Zac McCormick](https://github.com/zhm)** for the foundational [node-pg-query-native](https://github.com/zhm/node-pg-query-native) parser