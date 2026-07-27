# Direct Transformers for PostgreSQL AST

Direct transformers provide optimized, tree-shakeable modules for transforming PostgreSQL ASTs directly from one version to PG17.

## Features

- **Flexible Input**: Accept both `ParseResult` and any `Node` type
- **Type-Safe**: Full TypeScript support with overloaded signatures
- **Tree-Shakeable**: Each transformer is in its own module
- **Minimal Dependencies**: Only includes necessary transformers in the chain

## Usage

### Transform a Complete Parse Result

```typescript
import { PG15ToPG17Transformer } from '@pgsql/transform-ast/transformers-direct/v15-to-v17';
import { Parser } from '@pgsql/parser';

const parser = new Parser({ version: 15 });
const pg15Ast = await parser.parse('SELECT * FROM users');

const transformer = new PG15ToPG17Transformer();
const pg17Ast = transformer.transform(pg15Ast);
// pg17Ast is typed as V17Types.ParseResult
```

### Transform Any Node in the AST

```typescript
import { PG15ToPG17Transformer } from '@pgsql/transform-ast/transformers-direct/v15-to-v17';

// Transform just a statement node
const stmtNode = pg15Ast.stmts[0].stmt;
const transformedNode = transformer.transform(stmtNode);

// Transform a nested node (e.g., a WHERE clause)
const whereClause = stmtNode.SelectStmt.whereClause;
const transformedWhere = transformer.transform(whereClause);
```



## Available Transformers

| Transformer | Import Path | Dependencies |
|------------|-------------|--------------|
| PG16→PG17 | `@pgsql/transform-ast/transformers-direct/v16-to-v17` | v16→v17 only |
| PG15→PG17 | `@pgsql/transform-ast/transformers-direct/v15-to-v17` | v15→v16, v16→v17 |
| PG14→PG17 | `@pgsql/transform-ast/transformers-direct/v14-to-v17` | v14→v15, v15→v16, v16→v17 |
| PG13→PG17 | `@pgsql/transform-ast/transformers-direct/v13-to-v17` | All transformers |

## API Reference

### `transform(node)`

Transforms a node from the source PostgreSQL version to PG17.

**Overloads:**
- `transform(node: VXXTypes.Node): V17Types.Node` - Transform any node type
- `transform(node: VXXTypes.ParseResult): V17Types.ParseResult` - Transform a parse result

**Parameters:**
- `node` - The node or parse result to transform

**Returns:**
- The transformed node or parse result in PG17 format

### `transformStatement(stmt)` (Deprecated)

Legacy method for transforming statements. Use `transform()` instead.

## Type Usage

Import types directly from the version-specific type modules:

```typescript
import * as PG15 from '@pgsql/transform-ast/15/types';
import * as PG17 from '@pgsql/transform-ast/17/types';

// Use types for type annotations
const node: PG15.Node = ...;
const result: PG17.ParseResult = ...;
```

## Examples

### Transforming Complex Queries

```typescript
const complexSQL = `
  WITH active_users AS (
    SELECT * FROM users WHERE active = true
  )
  SELECT id, name FROM active_users
  ORDER BY name
  LIMIT 10
`;

const pg14Parser = new Parser({ version: 14 });
const pg14Ast = await pg14Parser.parse(complexSQL);

const transformer = new PG14ToPG17Transformer();
const pg17Ast = transformer.transform(pg14Ast);
```

### Transforming Specific Nodes

```typescript
// Transform just a WITH clause
const selectStmt = pg14Ast.stmts[0].stmt.SelectStmt;
const withClause = selectStmt.withClause;
const transformedWith = transformer.transform(withClause);

// Transform a WHERE clause
const whereClause = selectStmt.whereClause;
const transformedWhere = transformer.transform(whereClause);
```

## Benefits

1. **Reduced Bundle Size**: Only include the transformer you need
2. **Better Performance**: Less code to parse and execute
3. **Flexibility**: Transform any part of the AST, not just complete parse results
4. **Type Safety**: Full TypeScript support with proper type inference