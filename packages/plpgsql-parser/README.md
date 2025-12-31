# plpgsql-parser

Combined SQL + PL/pgSQL parser with hydrated ASTs and transform API.

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

## Re-exports

For power users, the package re-exports underlying primitives:

- `parseSql` - SQL parser from `@libpg-query/parser`
- `parsePlpgsqlBody` - PL/pgSQL parser from `@libpg-query/parser`
- `deparseSql` - SQL deparser from `pgsql-deparser`
- `deparsePlpgsqlBody` - PL/pgSQL deparser from `plpgsql-deparser`
- `hydratePlpgsqlAst` - Hydration utility from `plpgsql-deparser`
- `dehydratePlpgsqlAst` - Dehydration utility from `plpgsql-deparser`
