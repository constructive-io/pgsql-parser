# Deparser Usage Guide

The deparser converts PostgreSQL AST nodes back to SQL strings. It handles various input formats from libpg-query and custom node structures.

## Entry Points

### 1. ParseResult from libpg-query

The most common entry point - handles the complete parse result from libpg-query:

```typescript
import deparse from 'pgsql-deparser';

const parseResult = {
  version: 170004,
  stmts: [
    { stmt: { SelectStmt: {...} }, stmt_len: 32 },
    { stmt: { InsertStmt: {...} }, stmt_location: 20, stmt_len: 39 }
  ]
};

const sql = deparse(parseResult);
// Returns: "SELECT ...;\nINSERT ..."
```

**Structure:**
```typescript
ParseResult {
  version: number;
  stmts: RawStmt[];  // Array contains RawStmt objects inline
}

RawStmt {
  stmt: Node;
  stmt_len?: number;
  stmt_location?: number;
}
```

### 2. Wrapped ParseResult Node

When ParseResult is explicitly wrapped as a Node:

```typescript
const wrappedParseResult = {
  ParseResult: {
    version: 170004,
    stmts: [{ stmt: { SelectStmt: {...} }, stmt_len: 32 }]
  }
};

const sql = deparse(wrappedParseResult);
```

### 3. Wrapped RawStmt Node

For deparsing individual statements wrapped as nodes:

```typescript
const rawStmtNode = {
  RawStmt: {
    stmt: { SelectStmt: {...} },
    stmt_len: 32
  }
};

const sql = deparse(rawStmtNode);
// Returns: "SELECT ...;"
```

### 4. Array of Nodes

For deparsing multiple statement nodes:

```typescript
const nodes = [
  { SelectStmt: {...} },
  { InsertStmt: {...} }
];

const sql = deparse(nodes);
// Returns: "SELECT ...;\n\nINSERT ...;"
```

### 5. Single Statement Node

For deparsing individual statement nodes directly:

```typescript
const selectNode = { SelectStmt: {...} };
const sql = deparse(selectNode);
// Returns: "SELECT ..."
```

## Options

The deparser accepts an optional second parameter for configuration:

```typescript
const options = {
  // Add semicolons to statements (default: true for RawStmt with stmt_len)
  semicolons: true,
  
  // Custom context can be passed through
  myCustomOption: 'value'
};

const sql = deparse(parseResult, options);
```

### Pretty Formatting Options

The deparser supports pretty formatting to make SQL output more readable with proper indentation and line breaks:

```typescript
const options = {
  pretty: true,           // Enable pretty formatting (default: false)
  newline: '\n',         // Newline character (default: '\n')
  tab: '  ',             // Tab/indentation character (default: '  ')
  functionDelimiter: '$$', // Function body delimiter (default: '$$')
  functionDelimiterFallback: '$EOFCODE$' // Fallback delimiter (default: '$EOFCODE$')
};

const sql = deparse(parseResult, options);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pretty` | `boolean` | `false` | Enable pretty formatting with indentation and line breaks |
| `newline` | `string` | `'\n'` | Character(s) used for line breaks |
| `tab` | `string` | `'  '` | Character(s) used for indentation (2 spaces by default) |
| `functionDelimiter` | `string` | `'$$'` | Delimiter used for function bodies |
| `functionDelimiterFallback` | `string` | `'$EOFCODE$'` | Alternative delimiter when default is found in function body |

#### Pretty Formatting Examples

**Basic SELECT with pretty formatting:**
```typescript
// Without pretty formatting
const sql1 = deparse(selectAst, { pretty: false });
// Output: "SELECT id, name, email FROM users WHERE active = true;"

// With pretty formatting
const sql2 = deparse(selectAst, { pretty: true });
// Output:
// SELECT
//   id,
//   name,
//   email
// FROM users
// WHERE
//   active = true;
```

**Custom formatting characters:**
```typescript
const options = {
  pretty: true,
  newline: '\r\n',    // Windows line endings
  tab: '    '         // 4-space indentation
};

const sql = deparse(parseResult, options);
```

**Supported Statements:**
Pretty formatting is supported for:
- `SELECT` statements with proper clause alignment
- `CREATE TABLE` statements with column definitions
- `CREATE POLICY` statements with clause formatting
- Common Table Expressions (CTEs)
- Constraint definitions
- JOIN operations with proper alignment

**Important Notes:**
- Pretty formatting preserves SQL semantics - the formatted SQL parses to the same AST
- Multi-line string literals are preserved without indentation to maintain their content: indentation is applied only at line breaks the formatter itself emits, never at a newline inside a single-quoted (`'...'`), escape (`E'...'`) or dollar-quoted (`$tag$...$tag$`) string, a quoted identifier, or a comment — so a continuation line of a literal stays at column 0 while the SQL around it is indented:

```sql
CREATE TABLE t (
  memo text DEFAULT 'line one
line two'
)
```
- Complex expressions maintain proper parentheses and operator precedence

## Instance Usage

You can also create a deparser instance:

```typescript
import { Deparser } from 'pgsql-deparser';

const deparser = new Deparser(parseResult);
const sql = deparser.deparse();

// Or with options
const deparserWithOpts = new Deparser(parseResult, options);
const sqlWithOpts = deparserWithOpts.deparse();
```

## Important Notes

1. **RawStmt in ParseResult**: The `stmts` array in ParseResult contains RawStmt objects inline (not wrapped as nodes) due to the protobuf "repeated RawStmt" definition.

2. **Semicolon Handling**: Semicolons are automatically added to RawStmt objects that have a `stmt_len` property, indicating they were complete statements in the original SQL.

3. **Empty Statements**: Empty or null statements are filtered out automatically.

4. **Statement Joining**: 
   - Multiple statements in arrays are joined with `;\n\n` (semicolon + double newline)
   - Multiple statements from ParseResult are joined with `\n\n` (double newline)

## Type Guards

The deparser uses internal type guards to detect input types:

- `isParseResult()` - Detects bare ParseResult objects
- `isWrappedParseResult()` - Detects wrapped ParseResult nodes

These ensure proper handling of different input formats automatically.

## Examples

### Complete Example

```typescript
import { deparse } from 'pgsql-deparser';
import { parse } from 'pgsql-parser';

// Parse SQL
const sql = 'SELECT * FROM users; INSERT INTO logs (action) VALUES ($1);';
const parseResult = await parse(sql);

// Deparse back to SQL
const regeneratedSql = await deparse(parseResult);
console.log(regeneratedSql);
// Output: "SELECT * FROM users;\n\nINSERT INTO logs (action) VALUES ($1);"
```

### Custom Node Example

```typescript
// Creating a custom SELECT node
const customSelect = {
  SelectStmt: {
    targetList: [{
      ResTarget: {
        val: { ColumnRef: { fields: [{ String: { sval: '*' } }] } }
      }
    }],
    fromClause: [{
      RangeVar: {
        relname: 'users',
        inh: true,
        relpersistence: 'p'
      }
    }]
  }
};

const sql = await deparse(customSelect);
// Output: "SELECT * FROM users"
```
