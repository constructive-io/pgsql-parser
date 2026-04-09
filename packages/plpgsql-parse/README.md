# plpgsql-parse

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

Comment preserving PL/pgSQL parser. A wrapper around `plpgsql-parser` and `plpgsql-deparser` that preserves `--` line comments inside PL/pgSQL function bodies through parse-deparse round trips.

## Installation

```sh
npm install plpgsql-parse
```

## Features

* **Body Comment Preservation** -- Retains `--` line comments inside PL/pgSQL function bodies (`$$...$$`) through parse-deparse cycles
* **Outer SQL Comment Preservation** -- Preserves comments and whitespace outside function definitions via `pgsql-parse`
* **Idempotent Round-Trips** -- `parse -> deparse -> parse -> deparse` produces identical output
* **Non-Invasive** -- Does not modify `plpgsql-parser`, `plpgsql-deparser`, or any other upstream packages

## How It Works

1. Uses `pgsql-parse` for outer SQL comment and whitespace preservation
2. For each PL/pgSQL function, scans the `$$...$$` body to extract `--` comments with line numbers
3. Associates each comment with the nearest following PL/pgSQL statement (anchor)
4. On deparse, re-injects comments by matching statement keywords against the deparsed output

## API

### Parse

```typescript
import { parseSync, deparseSync, loadModule } from 'plpgsql-parse';

await loadModule();

const result = parseSync(`
-- Create a counter function
CREATE FUNCTION get_count() RETURNS int LANGUAGE plpgsql AS $$
BEGIN
  -- Count active users
  RETURN (SELECT count(*) FROM users WHERE active);
END;
$$;
`);

// result.enhanced contains outer SQL comments/whitespace
// result.functions contains body comments for each PL/pgSQL function
const sql = deparseSync(result);
// Output preserves both outer and body comments
```

## Credits

Built on the excellent work of several contributors:

* **[Dan Lynch](https://github.com/pyramation)** -- official maintainer since 2018 and architect of the current implementation
* **[Lukas Fittl](https://github.com/lfittl)** for [libpg_query](https://github.com/pganalyze/libpg_query) -- the core PostgreSQL parser that powers this project
