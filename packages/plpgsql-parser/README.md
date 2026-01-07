# plpgsql-parser

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE-MIT"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
   <a href="https://www.npmjs.com/package/plpgsql-parser"><img height="20" src="https://img.shields.io/github/package-json/v/constructive-io/pgsql-parser?filename=packages%2Fplpgsql-parser%2Fpackage.json"/></a>
</p>

Combined SQL + PL/pgSQL parser with hydrated ASTs and transform API.

> **⚠️ Experimental:** This package is currently experimental. If you're looking for just SQL parsing, see [`pgsql-parser`](https://www.npmjs.com/package/pgsql-parser). For body-only PL/pgSQL deparsing, see [`plpgsql-deparser`](https://www.npmjs.com/package/plpgsql-deparser).

## Overview

This package provides a unified API for **heterogeneous parsing and deparsing** of SQL scripts containing PL/pgSQL functions. It handles the full pipeline: parsing SQL + PL/pgSQL together, transforming ASTs, and deparsing back to complete SQL.

**Use this package when you need to:**
- Parse and deparse complete `CREATE FUNCTION` statements with PL/pgSQL bodies
- Transform both SQL and embedded PL/pgSQL expressions (e.g., rename schemas)
- Round-trip SQL through parse → modify → deparse

Key features:

- Auto-detects `CREATE FUNCTION` statements with `LANGUAGE plpgsql`
- Hydrates PL/pgSQL function bodies into structured ASTs
- Automatic `RETURN` statement handling based on function return type
- Transform API for parse → modify → deparse workflows
- Re-exports underlying primitives for power users

## Installation

```bash
npm install plpgsql-parser
```

## Usage

```typescript
import { parse, transform, deparseSync, loadModule } from 'plpgsql-parser';

// Initialize the WASM module
await loadModule();

// Parse SQL with PL/pgSQL functions - auto-detects and hydrates
const result = parse(`
  CREATE FUNCTION my_func(p_id int)
  RETURNS void
  LANGUAGE plpgsql
  AS $$
  BEGIN
    RAISE NOTICE 'Hello %', p_id;
  END;
  $$;
`);

console.log(result.functions.length); // 1
console.log(result.functions[0].plpgsql.hydrated); // Hydrated AST

// Transform API for parse -> modify -> deparse pipeline
const output = transformSync(sql, (ctx) => {
  // Modify the function name
  ctx.functions[0].stmt.funcname[0].String.sval = 'renamed_func';
});

// Deparse back to SQL
const sql = deparseSync(result, { pretty: true });
```

## API

### `parse(sql, options?)`

Parses SQL and auto-detects PL/pgSQL functions, hydrating their bodies.

Options:
- `hydrate` (default: `true`) - Whether to hydrate PL/pgSQL function bodies

Returns a `ParsedScript` with:
- `sql` - The raw SQL parse result
- `items` - Array of parsed items (statements and functions)
- `functions` - Array of detected PL/pgSQL functions with hydrated ASTs

### `transform(sql, callback, options?)`

Async transform pipeline: parse -> modify -> deparse.

### `transformSync(sql, callback, options?)`

Sync version of transform.

### `deparseSync(parsed, options?)`

Converts a parsed script back to SQL.

Options:
- `pretty` (default: `true`) - Whether to pretty-print the output

## Traverse API

The package provides a visitor pattern for traversing PL/pgSQL ASTs, similar to `@pgsql/traverse` but designed for PL/pgSQL node types.

### `walk(root, callback, options?)`

Walks the tree of PL/pgSQL AST nodes using a visitor pattern.

```typescript
import { parse, walk, loadModule } from 'plpgsql-parser';
import type { PLpgSQLVisitor } from 'plpgsql-parser';

await loadModule();

const parsed = parse(`
  CREATE FUNCTION get_user(p_id int)
  RETURNS text
  LANGUAGE plpgsql
  AS $$
  BEGIN
    RETURN (SELECT name FROM users WHERE id = p_id);
  END;
  $$;
`);

// Visit PL/pgSQL nodes
const visitor: PLpgSQLVisitor = {
  PLpgSQL_stmt_block: (path) => {
    console.log('Found block at path:', path.path);
  },
  PLpgSQL_stmt_return: (path) => {
    console.log('Found return statement');
  },
};

walk(parsed.functions[0].plpgsql.hydrated, visitor);
```

Options:
- `walkSqlExpressions` (default: `true`) - Whether to recurse into hydrated SQL expressions
- `sqlVisitor` - SQL visitor to use when walking hydrated SQL expressions (from `@pgsql/traverse`)

### `walkParsedScript(parsed, plpgsqlVisitor, sqlVisitor?)`

Convenience function that walks both SQL statements and PL/pgSQL function bodies.

```typescript
import { parse, walkParsedScript, loadModule } from 'plpgsql-parser';

await loadModule();

const parsed = parse(`
  CREATE TABLE users (id int);
  CREATE FUNCTION get_user(p_id int) RETURNS text LANGUAGE plpgsql AS $$
  BEGIN
    RETURN (SELECT name FROM users WHERE id = p_id);
  END;
  $$;
`);

walkParsedScript(
  parsed,
  // PL/pgSQL visitor
  {
    PLpgSQL_stmt_return: (path) => {
      console.log('PL/pgSQL return statement');
    },
  },
  // SQL visitor (optional) - visits both top-level SQL and embedded SQL in functions
  {
    CreateStmt: (path) => {
      console.log('CREATE TABLE statement');
    },
    RangeVar: (path) => {
      console.log('Table reference:', path.node.relname);
    },
  }
);
```

### `PLpgSQLNodePath`

The path object passed to visitor functions:

```typescript
class PLpgSQLNodePath<TTag extends string = string> {
  tag: TTag;           // Node type (e.g., 'PLpgSQL_stmt_block')
  node: any;           // The actual node data
  parent: PLpgSQLNodePath | null;  // Parent path
  keyPath: readonly (string | number)[];  // Full path array
  
  get path(): (string | number)[];  // Copy of keyPath
  get key(): string | number;       // Last element of path
}
```

## Re-exports

For power users, the package re-exports underlying primitives:

- `parseSql` - SQL parser from `@libpg-query/parser`
- `parsePlpgsqlBody` - PL/pgSQL parser from `@libpg-query/parser`
- `deparseSql` - SQL deparser from `pgsql-deparser`
- `deparsePlpgsqlBody` - PL/pgSQL deparser from `plpgsql-deparser`
- `hydratePlpgsqlAst` - Hydration utility from `plpgsql-deparser`
- `dehydratePlpgsqlAst` - Dehydration utility from `plpgsql-deparser`

## License

MIT
