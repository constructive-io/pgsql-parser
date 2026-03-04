# @pgsql/quotes

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>


<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE-MIT"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
</p>


PostgreSQL identifier quoting and keyword classification utilities. A faithful TypeScript port of PostgreSQL's `quote_identifier()` from `ruleutils.c`, with full keyword classification from `kwlist.h`.

## Installation

```bash
npm install @pgsql/quotes
```

## Usage

### Quoting Identifiers

```typescript
import { QuoteUtils } from '@pgsql/quotes';

// Simple identifiers are not quoted
QuoteUtils.quoteIdentifier('my_table');      // 'my_table'

// Reserved keywords are quoted
QuoteUtils.quoteIdentifier('select');        // '"select"'
QuoteUtils.quoteIdentifier('table');         // '"table"'

// Unreserved keywords are not quoted
QuoteUtils.quoteIdentifier('schema');        // 'schema'

// Identifiers with uppercase or special chars are quoted
QuoteUtils.quoteIdentifier('MyTable');       // '"MyTable"'
QuoteUtils.quoteIdentifier('my-table');      // '"my-table"'

// Embedded double quotes are escaped
QuoteUtils.quoteIdentifier('a"b');           // '"a""b"'
```

### Qualified Names

```typescript
import { QuoteUtils } from '@pgsql/quotes';

// Schema-qualified names
QuoteUtils.quoteQualifiedIdentifier('public', 'my_table');
// 'public.my_table'

// Dotted names (first part strict, rest relaxed)
QuoteUtils.quoteDottedName(['public', 'my_table']);
// 'public.my_table'

// Keywords after dot don't need quoting (PostgreSQL grammar rule)
QuoteUtils.quoteDottedName(['select', 'select']);
// '"select".select'
```

### Type Names

```typescript
import { QuoteUtils } from '@pgsql/quotes';

// Type names allow col_name and type_func_name keywords unquoted
QuoteUtils.quoteIdentifierTypeName('json');       // 'json'
QuoteUtils.quoteIdentifierTypeName('integer');    // 'integer'
QuoteUtils.quoteIdentifierTypeName('boolean');    // 'boolean'

// Only reserved keywords are quoted in type position
QuoteUtils.quoteIdentifierTypeName('select');     // '"select"'

// Schema-qualified type names
QuoteUtils.quoteTypeDottedName(['public', 'json']); // 'public.json'
```

### String Escaping

```typescript
import { QuoteUtils } from '@pgsql/quotes';

// Escape string literals
QuoteUtils.escape('hello');        // "'hello'"
QuoteUtils.escape("it's");        // "'it''s'"

// E-string formatting (auto-detects need for E prefix)
QuoteUtils.formatEString('a\\b'); // "E'a\\\\b'"
QuoteUtils.formatEString('hello'); // "'hello'"
```

### Keyword Classification

```typescript
import { keywordKindOf } from '@pgsql/quotes';
import type { KeywordKind } from '@pgsql/quotes';

keywordKindOf('select');  // 'RESERVED_KEYWORD'
keywordKindOf('schema');  // 'UNRESERVED_KEYWORD'
keywordKindOf('json');    // 'COL_NAME_KEYWORD'
keywordKindOf('join');    // 'TYPE_FUNC_NAME_KEYWORD'
keywordKindOf('foo');     // 'NO_KEYWORD'
```

### Raw Keyword Sets

```typescript
import {
  RESERVED_KEYWORDS,
  UNRESERVED_KEYWORDS,
  COL_NAME_KEYWORDS,
  TYPE_FUNC_NAME_KEYWORDS,
} from '@pgsql/quotes';

RESERVED_KEYWORDS.has('select');   // true
COL_NAME_KEYWORDS.has('json');     // true
```

## API

### QuoteUtils

| Method | Description |
|--------|-------------|
| `escape(literal)` | Wraps a string in single quotes, escaping embedded quotes |
| `escapeEString(value)` | Escapes backslashes and single quotes for E-string literals |
| `formatEString(value)` | Auto-detects and formats E-prefixed string literals |
| `needsEscapePrefix(value)` | Checks if a value needs E-prefix escaping |
| `quoteIdentifier(ident)` | Quotes an identifier if needed (port of PG's `quote_identifier`) |
| `quoteIdentifierAfterDot(ident)` | Quotes for lexical reasons only (post-dot position) |
| `quoteDottedName(parts)` | Quotes a multi-part dotted name (e.g., `schema.table`) |
| `quoteQualifiedIdentifier(qualifier, ident)` | Quotes a two-part qualified name |
| `quoteIdentifierTypeName(ident)` | Quotes an identifier in type-name context |
| `quoteTypeDottedName(parts)` | Quotes a multi-part dotted type name |

### keywordKindOf(word)

Returns the keyword classification for a given word. Case-insensitive.

Returns one of: `'NO_KEYWORD'`, `'UNRESERVED_KEYWORD'`, `'COL_NAME_KEYWORD'`, `'TYPE_FUNC_NAME_KEYWORD'`, `'RESERVED_KEYWORD'`.

## Updating Keywords

To regenerate the keyword list from a PostgreSQL source tree:

```bash
npm run keywords -- ~/path/to/postgres/src/include/parser/kwlist.h
```

This parses PostgreSQL's `kwlist.h` and regenerates `src/kwlist.ts`.
