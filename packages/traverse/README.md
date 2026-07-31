# @pgsql/traverse

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>


<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE-MIT"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
</p>


AST traversal for the pgsql-parser ecosystem: a Babel-style visitor pattern for PostgreSQL SQL ASTs **and** PL/pgSQL ASTs. Traversal only — nothing here parses SQL, so the package stays free of WASM.

## Installation

```bash
npm install @pgsql/traverse
```

## Which function do I want?

| Function | Walks | Use when |
| --- | --- | --- |
| `walk(ast, visitors, opts?)` | **any** AST — parsed script, `ParseResult`, SQL node, PL/pgSQL node | default choice |
| `walkSqlAst(ast, visitor)` | SQL AST only | you want the raw primitive, no statement context |
| `walkPlpgsqlAst(ast, visitor, opts?)` | PL/pgSQL AST only | you already have a hydrated function body |
| `traverse(ast, mutableVisitor)` | SQL AST, mutation-safe | you need to replace/insert/remove nodes |
| [`walkSql(text, ...)`](../plpgsql-parser) in `plpgsql-parser` | SQL **text** | you start from a string and need parse + hydrate |

## Usage

### `walk` — one entry point for any AST

`walk` dispatches on the shape of what you hand it:

| Input | Walked |
| --- | --- |
| `{ sql, functions }` (a `ParsedScript` from `plpgsql-parser`) | every statement, then every hydrated PL/pgSQL body |
| `{ version, stmts }` (a `ParseResult`) | every statement, with statement context |
| `{ PLpgSQL_*: ... }` / `{ plpgsql_funcs: [...] }` | the PL/pgSQL body, descending into its hydrated SQL expressions |
| any other SQL node | that node |
| an array | each element |

```typescript
import { walk } from '@pgsql/traverse';
import type { NodePath, Visitor, Walker } from '@pgsql/traverse';

// A walker function fires on every node.
walk(ast, (path) => {
  console.log(`Visiting ${path.tag} at path:`, path.path);
  if (path.tag === 'SelectStmt') {
    return false; // skip this node's children
  }
});

// A visitor object fires per node tag. SQL and PL/pgSQL tags may be mixed.
walk(ast, {
  SelectStmt: (path) => console.log('SELECT statement:', path.node),
  RangeVar: (path) => console.log('Table:', path.node.relname),
  PLpgSQL_stmt_dynexecute: (path) => console.log('dynamic EXECUTE:', path.node)
});
```

#### Statement context

Every callback gets a second argument describing the statement the node belongs
to. `NodePath` tells you *where* a node sits; `WalkContext` tells you *what it is
part of* — which is what a `RangeVar` handler needs to know it is the write
target of an `UPDATE`, or that it came from inside `auth.login`'s body.

```typescript
interface WalkContext {
  stmtTag: string | null;      // enclosing top-level statement, e.g. 'UpdateStmt'
  stmtIndex: number;           // its index in the script, -1 if unknown
  isWrite: boolean;            // INSERT/UPDATE/DELETE/MERGE/TRUNCATE/COPY
  isRead: boolean;             // SELECT/EXPLAIN/DECLARE/FETCH
  insideFunction: boolean;     // node came from a PL/pgSQL body
  functionName: string | null; // dotted name of that function
  abort(reason?: string): void;
}

walk(parsed, {
  RangeVar: (path, ctx) => {
    if (ctx.isWrite) console.log('writes to', path.node.relname);
    if (ctx.insideFunction) console.log('...from inside', ctx.functionName);
  }
});
```

The reserved `statement` key fires once per top-level statement, before its
children:

```typescript
walk(parseResult, {
  statement: (path, ctx) => console.log(ctx.stmtIndex, path.tag)
});
```

#### Composing visitors

Pass an array to run several independent policies in a single pass:

```typescript
walk(parsed, [blockedSchemas, readOnlySchemas, blockedFunctions]);
```

#### Skip vs. abort

`return false` skips that node's children. `ctx.abort(reason?)` ends the entire
walk — what a validator wants when it has already decided to reject:

```typescript
const result = walk(parsed, {
  PLpgSQL_stmt_dynexecute: (_path, ctx) => ctx.abort('dynamic EXECUTE is not allowed')
});

result.aborted; // true
result.reason;  // 'dynamic EXECUTE is not allowed'
result.reasons; // every reason, in call order
```

### `walkSqlAst` — the SQL-only primitive

Recursion is derived from PostgreSQL's runtime schema, so it knows exactly which
fields hold nodes, including untagged typed fields such as
`CreatePolicyStmt.table`. `walk` is built on it.

```typescript
import { walkSqlAst } from '@pgsql/traverse';
import type { Visitor, Walker } from '@pgsql/traverse';

const visitor: Visitor = {
  RangeVar: (path) => console.log('Table:', path.node.relname)
};

walkSqlAst(ast, visitor);
```

### `walkPlpgsqlAst` — the PL/pgSQL-only primitive

Walks the PL/pgSQL node universe (`PLpgSQL_stmt_block`, `PLpgSQL_stmt_if`,
`PLpgSQL_var`, ...), which the SQL parser never produces. A PL/pgSQL body is a
control-flow skeleton whose leaves are SQL expressions, so it bridges into
`walkSqlAst` for every hydrated expression:

```typescript
import { walkPlpgsqlAst } from '@pgsql/traverse';

walkPlpgsqlAst(hydratedBody, { PLpgSQL_var: (path) => console.log(path.node.refname) }, {
  walkSqlExpressions: true,
  sqlVisitor: { RangeVar: (path) => console.log('table in body:', path.node.relname) }
});
```

Hydration itself lives in `plpgsql-parser`.


### NodePath Class

The `NodePath` class provides rich context information:

```typescript
class NodePath<TTag extends NodeTag = NodeTag> {
  tag: TTag;           // Node type (e.g., 'SelectStmt', 'RangeVar')
  node: Node[TTag];    // The actual node data
  parent: NodePath | null;  // Parent NodePath (null for root)
  keyPath: readonly (string | number)[];  // Full path array
  
  get path(): (string | number)[];  // Copy of keyPath
  get key(): string | number;       // Last element of path
}
```

### Working with ParseResult

```typescript
import { walk } from '@pgsql/traverse';

const visitor = {
  ParseResult: (path) => {
    console.log('Parse result version:', path.node.version);
    console.log('Number of statements:', path.node.stmts.length);
  },
  SelectStmt: (path) => {
    console.log('SELECT statement found');
  }
};

walk(parseResult, visitor);
```

### Reading a node's position

`NodePath` describes where a node sits in the tree:

```typescript
const visitor = {
  RangeVar: (path) => {
    console.log('Table name:', path.node.relname);
    console.log('Path to this node:', path.path);
    console.log('Parent node:', path.parent?.tag);
    console.log('Key in parent:', path.key);
  }
};
```

### Collecting Information During Traversal

```typescript
import { walk } from '@pgsql/traverse';
import type { Visitor } from '@pgsql/traverse';

const tableNames: string[] = [];
const columnRefs: string[] = [];

const visitor: Visitor = {
  RangeVar: (path) => {
    if (path.node.relname) {
      tableNames.push(path.node.relname);
    }
  },
  ColumnRef: (path) => {
    for (const field of path.node.fields ?? []) {
      if (field.String?.sval) {
        columnRefs.push(field.String.sval);
      }
    }
  }
};

walk(ast, visitor);

console.log('Tables referenced:', tableNames);
console.log('Columns referenced:', columnRefs);
```

## API

### `walk(root, visitors, options?): WalkResult`

Walks any AST — SQL, PL/pgSQL, or a parsed script — with one or more visitors.

**Parameters:**
- `root`: the AST, parse result, or parsed script to traverse
- `visitors`: a walker function, a visitor object, or an array of either
- `options?`:
  - `walkFunctionBodies` (default `true`) — walk hydrated PL/pgSQL bodies of a parsed script
  - `walkSqlExpressions` (default `true`) — recurse into hydrated SQL expressions inside bodies
  - `sqlVisitor` — override the visitor used for those SQL expressions

**Returns** `{ aborted, reason?, reasons }`.

### `walkSqlAst(root, callback, parent?, keyPath?)`

The SQL-only primitive. Walks PostgreSQL AST nodes using the runtime schema for
precise traversal.

**Parameters:**
- `root`: The AST node to traverse
- `callback`: A walker function or visitor object
- `parent?`: Optional parent NodePath (for internal use)
- `keyPath?`: Optional key path array (for internal use)

### `walkPlpgsqlAst(root, callback, options?, parent?, keyPath?)`

The PL/pgSQL-only primitive.

**Parameters:**
- `root`: The PL/pgSQL AST node to traverse
- `callback`: A walker function or visitor object keyed by `PLpgSQL_*` tags
- `options?`: `{ walkSqlExpressions?, sqlVisitor? }`

### `traverse(root, mutableVisitor)`

The mutation-capable walker: `enter`/`exit` hooks and sibling insert/remove/replace
through `MutablePath`. Use it when the walk needs to change the tree; `walk` is
read-only.

### Types

#### `WalkContext`

Statement context threaded into every `walk` callback:

```typescript
interface WalkContext {
  readonly stmtTag: string | null;
  readonly stmtIndex: number;
  readonly isWrite: boolean;
  readonly isRead: boolean;
  readonly insideFunction: boolean;
  readonly functionName: string | null;
  abort(reason?: string): void;
}
```

#### `WalkResult`

What `walk` returns:

```typescript
interface WalkResult {
  aborted: boolean;   // a visitor called ctx.abort()
  reason?: string;    // the first reason given
  reasons: string[];  // every reason, in call order
}
```


#### `Visitor`

An object type where keys are node type names and values are walker functions:

```typescript
type Visitor = {
  [TTag in NodeTag]?: Walker<NodePath<TTag>>;
};
```

#### `Walker`

A function that receives a NodePath and can return false to skip children:

```typescript
type Walker<TNodePath extends NodePath = NodePath> = (
  path: TNodePath,
) => boolean | void;
```

#### `NodePath`

A class that encapsulates node traversal context:

```typescript
class NodePath<TTag extends NodeTag = NodeTag> {
  tag: TTag;                                    // Node type
  node: Node[TTag];                            // Node data
  parent: NodePath | null;                     // Parent path
  keyPath: readonly (string | number)[];       // Full path
  
  get path(): (string | number)[];             // Path copy
  get key(): string | number;                  // Current key
}
```

#### `NodeTag`

Union type of all PostgreSQL AST node type names:

```typescript
type NodeTag = keyof Node;
```

## Supported Node Types

This package works with all PostgreSQL AST node types defined in `@pgsql/types`, including:

- `ParseResult` - Root parse result from libpg-query
- `SelectStmt` - SELECT statements
- `InsertStmt` - INSERT statements
- `UpdateStmt` - UPDATE statements
- `DeleteStmt` - DELETE statements
- `RangeVar` - Table references
- `ColumnRef` - Column references
- `A_Expr` - Expressions
- `A_Const` - Constants
- And many more...

## Integration with pgsql-parser

This package is designed to work seamlessly with the pgsql-parser ecosystem:

```typescript
import { parse } from 'pgsql-parser';
import { walk } from '@pgsql/traverse';

const sql = 'SELECT name, email FROM users WHERE age > 18';
const ast = await parse(sql);

walk(ast, {
  RangeVar: (path) => {
    console.log('Table:', path.node.relname);
  },
  ColumnRef: (path) => {
    console.log('Column:', path.node.fields?.[0]?.String?.sval);
  }
});
```

Starting from SQL text? `plpgsql-parser`'s `walkSql` does the parse and the
PL/pgSQL hydration for you, then hands off to `walk`.