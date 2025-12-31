# plpgsql-deparser

PL/pgSQL AST Deparser - Converts PL/pgSQL function ASTs back to SQL strings.

## Overview

This package provides a deparser for PL/pgSQL (PostgreSQL's procedural language) AST structures. It works with the AST output from `parsePlPgSQL` function in `@libpg-query/parser` (or `libpg-query-full`).

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

The PL/pgSQL AST returned by `parsePlPgSQL` represents the internal structure of function bodies, not the `CREATE FUNCTION` statement itself. To get a complete function definition, you would need to:

1. Parse the `CREATE FUNCTION` statement with the regular `parse()` function
2. Extract the function body
3. Parse the body with `parsePlPgSQL()`
4. Deparse the body with this package
5. Combine with the outer `CREATE FUNCTION` statement

## License

MIT
