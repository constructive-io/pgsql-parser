# plpgsql-deparser

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE-MIT"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
   <a href="https://www.npmjs.com/package/plpgsql-deparser"><img height="20" src="https://img.shields.io/github/package-json/v/constructive-io/pgsql-parser?filename=packages%2Fplpgsql-deparser%2Fpackage.json"/></a>
</p>

PL/pgSQL AST Deparser - Converts PL/pgSQL function ASTs back to SQL strings.

> **⚠️ Experimental:** This package is currently experimental. If you're looking for SQL deparsing (not PL/pgSQL), see [`pgsql-deparser`](https://www.npmjs.com/package/pgsql-deparser).

> **For full SQL + PL/pgSQL deparsing:** If you need to deparse complete `CREATE FUNCTION` statements (not just function bodies), use [`plpgsql-parser`](https://www.npmjs.com/package/plpgsql-parser) instead. It handles the full heterogeneous parsing/deparsing pipeline automatically.

## Overview

This package provides a **body-only** deparser for PL/pgSQL (PostgreSQL's procedural language) AST structures. It converts PL/pgSQL function bodies (the `BEGIN...END` part) back to strings. It works with the AST output from `parsePlPgSQL` function in `@libpg-query/parser`.

The PL/pgSQL AST is different from the regular SQL AST - it represents the internal structure of PL/pgSQL function bodies, including:

- Variable declarations (DECLARE section)
- Control flow statements (IF, CASE, LOOP, WHILE, FOR, FOREACH)
- Exception handling (BEGIN...EXCEPTION...END)
- Cursor operations (OPEN, FETCH, CLOSE)
- Return statements (RETURN, RETURN NEXT, RETURN QUERY)
- Dynamic SQL (EXECUTE)
- And more...

## Installation

```bash
npm install plpgsql-deparser
```

## Usage

### Basic Usage

```typescript
import { parsePlPgSQL } from '@libpg-query/parser';
import { deparse, PLpgSQLDeparser } from 'plpgsql-deparser';

// Parse a PL/pgSQL function
const funcSql = `
CREATE OR REPLACE FUNCTION test_func()
RETURNS INTEGER AS $$
DECLARE
  sum int := 0;
BEGIN
  FOR n IN 1..10 LOOP
    sum := sum + n;
  END LOOP;
  RETURN sum;
END;
$$ LANGUAGE plpgsql;
`;

const parseResult = await parsePlPgSQL(funcSql);

// Deparse the function body
const deparsed = await deparse(parseResult);
console.log(deparsed);
```

### Synchronous Usage

```typescript
import { deparseSync, PLpgSQLDeparser } from 'plpgsql-deparser';

const deparsed = deparseSync(parseResult);
```

### With Options

```typescript
import { PLpgSQLDeparser } from 'plpgsql-deparser';

const deparser = new PLpgSQLDeparser({
  indent: '    ',      // 4 spaces instead of default 2
  newline: '\n',       // newline character
  uppercase: false,    // lowercase keywords
});

const deparsed = deparser.deparseResult(parseResult);
```

### Deparse a Single Function

```typescript
import { PLpgSQLDeparser } from 'plpgsql-deparser';

// If you have just the function body AST
const funcBody = parseResult.plpgsql_funcs[0].PLpgSQL_function;
const deparsed = PLpgSQLDeparser.deparseFunction(funcBody);
```

## Supported PL/pgSQL Constructs

### Declarations
- Variable declarations with types, defaults, and constraints
- CONSTANT, NOT NULL modifiers
- RECORD types
- Cursor declarations

### Control Flow
- IF / ELSIF / ELSE / END IF
- CASE (simple and searched)
- LOOP / END LOOP
- WHILE ... LOOP
- FOR i IN ... LOOP (integer range)
- FOR rec IN query LOOP
- FOR rec IN cursor LOOP
- FOREACH ... IN ARRAY

### Exception Handling
- BEGIN ... EXCEPTION ... END blocks
- WHEN condition THEN handlers
- Multiple exception conditions

### Cursor Operations
- OPEN cursor
- FETCH cursor INTO
- CLOSE cursor
- MOVE cursor

### Return Statements
- RETURN expression
- RETURN NEXT
- RETURN QUERY
- RETURN QUERY EXECUTE

### Other Statements
- Assignment (:=)
- RAISE (DEBUG, LOG, INFO, NOTICE, WARNING, EXCEPTION)
- ASSERT
- PERFORM
- EXECUTE (dynamic SQL)
- GET DIAGNOSTICS
- COMMIT / ROLLBACK
- EXIT / CONTINUE

## API Reference

### `deparse(parseResult, options?)`

Async function to deparse a PL/pgSQL parse result.

### `deparseSync(parseResult, options?)`

Synchronous version of `deparse`.

### `deparseFunction(func, options?)`

Deparse a single PL/pgSQL function body.

### `deparseFunctionSync(func, options?)`

Synchronous version of `deparseFunction`.

### `PLpgSQLDeparser`

The main deparser class with full control over the deparsing process.

### `PLpgSQLDeparserOptions`

```typescript
interface PLpgSQLDeparserOptions {
  indent?: string;    // Indentation string (default: '  ')
  newline?: string;   // Newline character (default: '\n')
  uppercase?: boolean; // Uppercase keywords (default: true)
}
```

## Note on AST Structure

This package deparses **only the function body** (the `BEGIN...END` part), not the full `CREATE FUNCTION` statement.

For full SQL + PL/pgSQL deparsing, use [`plpgsql-parser`](https://www.npmjs.com/package/plpgsql-parser):

```typescript
import { parse, deparseSync, loadModule } from 'plpgsql-parser';

await loadModule();

const parsed = parse(`
  CREATE FUNCTION my_func() RETURNS void LANGUAGE plpgsql AS $$
  BEGIN
    RAISE NOTICE 'Hello';
  END;
  $$;
`);

// Full round-trip: parses SQL + PL/pgSQL, deparses back to complete SQL
const sql = deparseSync(parsed);
```

The `plpgsql-parser` package handles:
- Parsing the outer `CREATE FUNCTION` statement
- Hydrating embedded SQL expressions in the PL/pgSQL body
- Correct `RETURN` statement handling based on function return type
- Stitching the deparsed body back into the full SQL

## License

MIT
