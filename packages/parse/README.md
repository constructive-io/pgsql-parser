# pgsql-parse

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

Comment and whitespace preserving PostgreSQL parser. A drop-in enhancement for `pgsql-parser` that preserves SQL comments (`--` line and `/* */` block) and vertical whitespace (blank lines) through parse-deparse round trips.

## Installation

```sh
npm install pgsql-parse
```

## Features

* **Comment Preservation** -- Retains `--` line comments and `/* */` block comments through parse-deparse cycles
* **Vertical Whitespace** -- Preserves blank lines between statements for readable output
* **Idempotent Round-Trips** -- `parse -> deparse -> parse -> deparse` produces identical output
* **Drop-in API** -- Re-exports `parse`, `parseSync`, `deparse`, `deparseSync`, `loadModule` from `pgsql-parser`
* **Synthetic AST Nodes** -- `RawComment` and `RawWhitespace` nodes interleaved into the `stmts` array by byte position

## How It Works

1. A pure TypeScript scanner extracts comment and whitespace tokens with byte positions from the raw SQL text
2. Enhanced `parse`/`parseSync` call the standard `libpg-query` parser, then interleave synthetic `RawComment` and `RawWhitespace` nodes into the `stmts` array based on byte position
3. `deparseEnhanced()` dispatches on node type -- real `RawStmt` entries go through the standard deparser, while synthetic nodes emit their comment text or blank lines directly

## API

### Enhanced Parse

```typescript
import { parse, parseSync, deparseEnhanced, loadModule } from 'pgsql-parse';

// Async (handles initialization automatically)
const result = await parse(`
-- Create users table
CREATE TABLE users (id serial PRIMARY KEY);

-- Create posts table
CREATE TABLE posts (id serial PRIMARY KEY);
`);

// result.stmts contains RawComment, RawWhitespace, and RawStmt nodes
const sql = deparseEnhanced(result);
// Output preserves comments and blank lines
```

### Sync Methods

```typescript
import { parseSync, deparseEnhanced, loadModule } from 'pgsql-parse';

await loadModule();

const result = parseSync('-- comment\nSELECT 1;');
const sql = deparseEnhanced(result);
```

### Type Guards

```typescript
import { isRawComment, isRawWhitespace, isRawStmt } from 'pgsql-parse';

for (const stmt of result.stmts) {
  if (isRawComment(stmt)) {
    console.log('Comment:', stmt.RawComment.text);
  } else if (isRawWhitespace(stmt)) {
    console.log('Blank lines:', stmt.RawWhitespace.lines);
  } else if (isRawStmt(stmt)) {
    console.log('Statement:', stmt);
  }
}
```

## Credits

Built on the excellent work of several contributors:

* **[Dan Lynch](https://github.com/pyramation)** -- official maintainer since 2018 and architect of the current implementation
* **[Lukas Fittl](https://github.com/lfittl)** for [libpg_query](https://github.com/pganalyze/libpg_query) -- the core PostgreSQL parser that powers this project
