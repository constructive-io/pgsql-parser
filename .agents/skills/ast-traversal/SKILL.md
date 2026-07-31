---
name: ast-traversal
description: How to walk PostgreSQL SQL and PL/pgSQL ASTs in this monorepo — choosing between walk, walkSql, walkSqlAst, walkPlpgsqlAst, and traverse; statement context, visitor composition, abort, and mutation. Use when reading, validating, or rewriting SQL/PL/pgSQL ASTs.
---

# AST Traversal

Everything in this repo that inspects or rewrites SQL goes through one of five
functions. Pick the right one first; the rest of the work follows from it.

## Choosing a function

| Function | Package | Walks | Mutates |
|---|---|---|---|
| `walk(ast, visitors, opts?)` | `@pgsql/traverse` | any AST — parsed script, `ParseResult`, SQL node, PL/pgSQL node | no |
| `walkSql(text, visitors, opts?)` | `plpgsql-parser` | SQL **text**: parses, hydrates PL/pgSQL bodies, then `walk`s | no |
| `walkSqlAst(ast, visitor)` | `@pgsql/traverse` | SQL AST only | no |
| `walkPlpgsqlAst(ast, visitor, opts?)` | `@pgsql/traverse` | PL/pgSQL AST only | no |
| `traverse(ast, mutableVisitor)` | `@pgsql/traverse` | SQL AST, with insert/remove/replace | yes |

Decision rules:

- **Have a string?** `walkSql`. It is the only entry point that parses.
- **Have an AST and don't care which universe it is from?** `walk`.
- **Want exactly one node universe and no statement context?** `walkSqlAst` or
  `walkPlpgsqlAst`. These are the primitives `walk` is built on; reach for them
  when writing a reusable visitor that some other walker will drive (this is why
  `@pgsql/transform` exports visitor *factories* rather than walkers).
- **Need to change the tree structurally?** `traverse`. Note that read-only
  walkers hand you the real node objects, so field-level edits (renaming a
  schema, rewriting a name list) work under `walk` too — `traverse` is for
  inserting, removing, and replacing nodes.

Never hand-roll `transformSync(sql, ..., { hydrate: true })` plus a
per-statement loop plus a PL/pgSQL walk. That harness *is* `walk`.

## Visitors

A visitor is either a callback (fires on every node) or an object keyed by node
tag. SQL tags and `PLpgSQL_*` tags may be mixed in one object — `walk` routes
each node to the right walker.

```ts
import { walk } from '@pgsql/traverse';

walk(ast, {
  RangeVar: (path) => console.log(path.node.relname),
  PLpgSQL_stmt_dynexecute: (path) => console.log('dynamic EXECUTE', path.node)
});
```

Pass an **array** of visitors to run independent concerns in a single parse:

```ts
walkSql(sql, [blockedSchemas, readOnlySchemas, blockedFunctions]);
```

Each callback receives `(path, ctx)`:

- `path` — a `NodePath` (SQL) or `PlpgsqlNodePath` (PL/pgSQL): `tag`, `node`,
  `parent`, `keyPath`. This is *structure*: where the node sits.
- `ctx` — a `WalkContext`: `stmtTag`, `stmtIndex`, `isWrite`, `isRead`,
  `insideFunction`, `functionName`, `abort()`. This is *situation*: what the
  node is part of.

The reserved `statement` key fires once per top-level statement, before its
children — the hook for per-statement setup or classification.

## Control flow

Two distinct mechanisms, do not confuse them:

- `return false` — skip this node's children, keep walking siblings.
- `ctx.abort(reason?)` — end the whole walk. `walk`/`walkSql` return
  `{ aborted, reason, reasons }`. This is what a validator wants: the first
  rejection ends the work.

```ts
const result = walkSql(sql, {
  RangeVar: (path, ctx) => {
    if (ctx.isWrite && path.node.schemaname === 'audit') {
      ctx.abort(`cannot write to ${path.node.schemaname}`);
    }
  }
});
if (result.aborted) reject(result.reason);
```

Unparseable input from `walkSql` comes back as `{ aborted: true, reason }`
rather than a thrown error, so "rejected" and "not understood" are one code path.

## Worked examples

### Collect every table a script touches, including inside function bodies

```ts
import { loadModule, walkSql } from 'plpgsql-parser';

await loadModule(); // once per process: libpg-query is WASM

const tables = new Set<string>();
walkSql(sql, {
  RangeVar: (path, ctx) => {
    const name = path.node.schemaname
      ? `${path.node.schemaname}.${path.node.relname}`
      : path.node.relname;
    tables.add(ctx.insideFunction ? `${name} (via ${ctx.functionName})` : name);
  }
});
```

### Classify statements without a second parse

```ts
walkSql(sql, {
  statement: (path, ctx) => {
    console.log(ctx.stmtIndex, path.tag, ctx.isWrite ? 'write' : 'read');
  }
});
```

### Rewrite schema names on a parsed script

Field-level rewrites work through the read-only walker because `path.node` is the
live node. This is exactly how `@pgsql/transform` renames schemas:

```ts
import { transformSync } from 'plpgsql-parser';
import { walk } from '@pgsql/traverse';

const out = transformSync(sql, (ctx) => {
  walk(ctx, {
    RangeVar: (path) => {
      const to = mapping.get(path.node.schemaname);
      if (to) path.node.schemaname = to;
    }
  });
}, { hydrate: true, pretty: true });
```

`transformSync` gives the callback a parsed script (`{ sql, functions }`), which
`walk` dispatches over directly — statements first, then every hydrated body.

### Restructure the tree

```ts
import { traverse } from '@pgsql/traverse';

traverse(ast, {
  RawStmt: {
    enter: (path) => {
      if (isRedundant(path.node)) path.remove();
    }
  }
});
```

### Drive a reusable visitor from a primitive

When a caller already owns the traversal loop (per-statement state, custom
ordering), build the visitor separately and hand it to the primitive:

```ts
import { walkSqlAst } from '@pgsql/traverse';

for (const stmt of parseResult.stmts) {
  walkSqlAst(stmt.stmt, createFactsVisitor(factsFor(stmt)));
}
```

## Options

`walk` and `walkSql` share:

- `walkFunctionBodies` (default `true`) — walk hydrated PL/pgSQL bodies. Under
  `walkSql`, `false` also skips the PL/pgSQL parse, so turn it off when the
  visitors only care about top-level SQL.
- `walkSqlExpressions` (default `true`) — recurse into the SQL expressions inside
  those bodies.
- `sqlVisitor` — override the visitor used for those SQL expressions.

## Gotchas

- **Call `loadModule()` before any parse.** `libpg-query` is WASM; `parseSync` /
  `walkSql` throw `WASM module not initialized` otherwise.
- **PL/pgSQL bodies are opaque until hydrated.** Without `{ hydrate: true }` a
  function body is a query string, and no SQL visitor will ever fire inside it.
- **Untagged typed fields exist.** `CreatePolicyStmt.table` is a bare `RangeVar`
  with no `{ RangeVar: ... }` wrapper. `walkSqlAst` handles this via the runtime
  schema, which is why hand-written recursion over `Object.keys` misses nodes.
- **`@pgsql/traverse` must stay parser-free.** It depends on types only; adding a
  parser dependency would cycle and pull WASM into the leaf package. Anything
  that needs to parse belongs in `plpgsql-parser` or above.
- **Fixtures are the regression gate for transform work.** After changing any
  traversal in `@pgsql/transform`, `pnpm --filter @pgsql/transform test` output
  must be byte-identical; see the `testing-fixtures` skill.
