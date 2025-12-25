# PostgreSQL Identifier Quoting Rules

This document describes the identifier quoting strategy used by the pgsql-deparser package. It explains the underlying PostgreSQL rules, our implementation choices, and guidance for contributors.

## Goals and Non-Goals

### Goals

The deparser aims to emit valid PostgreSQL SQL that can be re-parsed by PostgreSQL (and by libpg-query). Additionally, we aim to emit minimally-quoted SQL when safe, especially for qualified names, in order to reduce noisy diffs. For example, we prefer `faker.float` over `faker."float"` when the grammar allows it.

### Non-Goals

We do not preserve the user's original quoting style. If the input SQL used `"mycolumn"` but `mycolumn` is safe to emit unquoted, we may emit it unquoted.

We do not preserve identifier case unless quoting is required. Unquoted identifiers are folded to lowercase by PostgreSQL, so `MyFunc` and `myfunc` are equivalent when unquoted. If case preservation is needed, the identifier must be quoted.

We do not implement PostgreSQL's `quote_all_identifiers` mode (used by pg_dump for deterministic dumps). This could be added as a deparser option in the future if needed.

## PostgreSQL Background: What Quoting Means

### Identifier Folding

PostgreSQL folds unquoted identifiers to lowercase. This means:

- `SELECT * FROM MyTable` is equivalent to `SELECT * FROM mytable`
- `SELECT * FROM "MyTable"` preserves the mixed case and refers to a table literally named `MyTable`

If you need to preserve uppercase letters, spaces, or special characters in an identifier, you must quote it.

### When Quotes Are Required

An identifier must be quoted if any of the following are true:

1. **First character is not a lowercase letter or underscore**: Identifiers starting with uppercase letters, digits, or special characters must be quoted.

2. **Contains characters outside the safe set**: Only lowercase letters (`a-z`), digits (`0-9`), and underscores (`_`) are considered safe. Note that `$` is explicitly excluded even though PostgreSQL allows it in some contexts; our implementation is conservative.

3. **Is a SQL keyword**: Keywords must be quoted to be used as identifiers, with one exception: `UNRESERVED_KEYWORD` tokens can be used as identifiers without quotes in most contexts.

4. **Contains embedded double quotes**: These must be escaped by doubling them (`"` becomes `""`).

### Keyword Categories in PostgreSQL

PostgreSQL classifies keywords into four categories (defined in `kwlist.h` / our `kwlist.ts`):

| Category | Description | Quoting Required? |
|----------|-------------|-------------------|
| `UNRESERVED_KEYWORD` | Can be used as identifiers in most contexts | No |
| `COL_NAME_KEYWORD` | Reserved in some contexts, allowed as column names | Yes (in strict mode) |
| `TYPE_FUNC_NAME_KEYWORD` | Reserved in some contexts, allowed as type/function names | Yes (in strict mode) |
| `RESERVED_KEYWORD` | Fully reserved, cannot be used as identifiers without quotes | Yes |

Examples:
- `abort`, `absolute`, `access` are `UNRESERVED_KEYWORD` - no quoting needed
- `float`, `interval`, `boolean` are `COL_NAME_KEYWORD` - quoting depends on context
- `left`, `right`, `join` are `TYPE_FUNC_NAME_KEYWORD` - quoting depends on context
- `select`, `from`, `where`, `table` are `RESERVED_KEYWORD` - always need quoting as identifiers

## The Strict Quoting Algorithm

The `QuoteUtils.quoteIdentifier()` function implements PostgreSQL's `quote_identifier()` algorithm from `ruleutils.c`. This is the "strict" or "canonical" quoting policy.

### Algorithm

```
function quoteIdentifier(ident):
    if ident is empty:
        return ident
    
    safe = true
    
    // Rule 1: First character must be lowercase letter or underscore
    if first_char not in [a-z_]:
        safe = false
    
    // Rule 2: All characters must be in safe set
    for each char in ident:
        if char not in [a-z0-9_]:
            safe = false
    
    // Rule 3: Must not be a keyword (except UNRESERVED_KEYWORD)
    if safe:
        kwKind = keywordKindOf(ident)
        if kwKind != NO_KEYWORD and kwKind != UNRESERVED_KEYWORD:
            safe = false
    
    if safe:
        return ident  // No quoting needed
    
    // Build quoted identifier with escaped embedded quotes
    result = '"'
    for each char in ident:
        if char == '"':
            result += '"'  // Escape " as ""
        result += char
    result += '"'
    
    return result
```

### Examples

| Input | Output | Reason |
|-------|--------|--------|
| `mytable` | `mytable` | All lowercase, not a keyword |
| `my_table_2` | `my_table_2` | Safe characters only |
| `MyTable` | `"MyTable"` | Contains uppercase |
| `my-table` | `"my-table"` | Contains hyphen |
| `my table` | `"my table"` | Contains space |
| `2fast` | `"2fast"` | Starts with digit |
| `float` | `"float"` | COL_NAME_KEYWORD |
| `select` | `"select"` | RESERVED_KEYWORD |
| `abort` | `abort` | UNRESERVED_KEYWORD |
| `say"hello` | `"say""hello"` | Contains embedded quote |

## Why a Second Policy Exists: Grammar-Slot Sensitivity

PostgreSQL's `quote_identifier()` function is intentionally conservative and context-free. It doesn't know where the identifier will be used, so it quotes anything that might cause problems in any context.

However, PostgreSQL's grammar is context-sensitive. Different syntactic positions accept different sets of tokens. The key insight is:

**Identifiers that appear after a dot (in qualified names) are in highly permissive grammar positions that accept all keyword categories, including `RESERVED_KEYWORD`.**

This means that while `float()` as a standalone function call would fail to parse (because `float` is a `COL_NAME_KEYWORD`), `faker.float()` parses successfully because the `float` appears after a dot.

### Empirical Verification

We verified this behavior by testing with libpg-query:

| SQL | Parses? | Reason |
|-----|---------|--------|
| `SELECT float()` | No | `float` is COL_NAME_KEYWORD, conflicts with type name |
| `SELECT faker.float()` | Yes | After dot, all keywords accepted |
| `SELECT select FROM t` | No | `select` is RESERVED_KEYWORD |
| `SELECT t.select FROM t` | Yes | After dot, all keywords accepted |
| `SELECT * FROM interval` | No | `interval` is COL_NAME_KEYWORD |
| `SELECT * FROM myschema.interval` | Yes | After dot, all keywords accepted |

### The Deparser's Opportunity

Since we know that identifiers after a dot are in permissive positions, we can emit them without keyword-based quoting. This produces cleaner output:

- Instead of `faker."float"()` we emit `faker.float()`
- Instead of `pg_catalog."substring"()` we emit `pg_catalog.substring()`
- Instead of `t."select"` we emit `t.select`

This is an intentional deviation from PostgreSQL's `quote_identifier()` behavior, designed to produce minimal quoting while still emitting valid SQL.

## The Relaxed Quoting Algorithm (After-Dot)

The `QuoteUtils.quoteIdentifierAfterDot()` function implements "lexical-only" quoting for identifiers in permissive after-dot positions.

### Algorithm

```
function quoteIdentifierAfterDot(ident):
    if ident is empty:
        return ident
    
    safe = true
    
    // Rule 1: First character must be lowercase letter or underscore
    if first_char not in [a-z_]:
        safe = false
    
    // Rule 2: All characters must be in safe set
    for each char in ident:
        if char not in [a-z0-9_]:
            safe = false
    
    // NOTE: No keyword check! Keywords are allowed after dots.
    
    if safe:
        return ident  // No quoting needed
    
    // Build quoted identifier with escaped embedded quotes
    result = '"'
    for each char in ident:
        if char == '"':
            result += '"'
        result += char
    result += '"'
    
    return result
```

### Key Difference from Strict Quoting

The only difference is that `quoteIdentifierAfterDot()` does not check for keywords. It still quotes for:
- Uppercase letters (case preservation)
- Special characters (hyphens, spaces, etc.)
- Leading digits
- Embedded quotes

### Examples

| Input | quoteIdentifier() | quoteIdentifierAfterDot() |
|-------|-------------------|---------------------------|
| `mytable` | `mytable` | `mytable` |
| `MyTable` | `"MyTable"` | `"MyTable"` |
| `float` | `"float"` | `float` |
| `select` | `"select"` | `select` |
| `interval` | `"interval"` | `interval` |
| `my-col` | `"my-col"` | `"my-col"` |

## Type-Name Quoting Policy

Type names in PostgreSQL have their own quoting policy that is less strict than standalone identifiers but different from after-dot identifiers.

### The Problem

When you have a user-defined schema-qualified type like `myschema.json`, the type name `json` is a `COL_NAME_KEYWORD`. Using strict quoting (`quoteIdentifier()`) would produce `myschema."json"`, which is unnecessarily verbose.

However, we cannot use the fully relaxed after-dot policy (`quoteIdentifierAfterDot()`) because type names are not in the same permissive grammar slot as identifiers after a dot in qualified names.

### The Type-Name Quoting Algorithm

The `QuoteUtils.quoteIdentifierTypeName()` function implements a middle-ground policy:

- **Quote for lexical reasons**: uppercase, special characters, leading digits, embedded quotes
- **Quote only RESERVED_KEYWORD**: keywords like `select`, `from`, `where` must be quoted
- **Allow COL_NAME_KEYWORD unquoted**: keywords like `json`, `int`, `boolean` are allowed
- **Allow TYPE_FUNC_NAME_KEYWORD unquoted**: keywords like `interval`, `left`, `right` are allowed

```
function quoteIdentifierTypeName(ident):
    if ident is empty:
        return ident
    
    safe = true
    
    // Rule 1: First character must be lowercase letter or underscore
    if first_char not in [a-z_]:
        safe = false
    
    // Rule 2: All characters must be in safe set
    for each char in ident:
        if char not in [a-z0-9_]:
            safe = false
    
    // Rule 3: Only quote RESERVED_KEYWORD (not COL_NAME_KEYWORD or TYPE_FUNC_NAME_KEYWORD)
    if safe:
        kwKind = keywordKindOf(ident)
        if kwKind == RESERVED_KEYWORD:
            safe = false
    
    if safe:
        return ident  // No quoting needed
    
    // Build quoted identifier with escaped embedded quotes
    result = '"'
    for each char in ident:
        if char == '"':
            result += '"'
        result += char
    result += '"'
    
    return result
```

### Comparison of Quoting Policies

| Input | quoteIdentifier() | quoteIdentifierAfterDot() | quoteIdentifierTypeName() |
|-------|-------------------|---------------------------|---------------------------|
| `mytable` | `mytable` | `mytable` | `mytable` |
| `MyTable` | `"MyTable"` | `"MyTable"` | `"MyTable"` |
| `json` | `"json"` | `json` | `json` |
| `int` | `"int"` | `int` | `int` |
| `boolean` | `"boolean"` | `boolean` | `boolean` |
| `interval` | `"interval"` | `interval` | `interval` |
| `select` | `"select"` | `select` | `"select"` |
| `from` | `"from"` | `from` | `"from"` |

### quoteTypeDottedName(parts: string[])

For schema-qualified type names, use `quoteTypeDottedName()` which applies type-name quoting to all parts:

```typescript
static quoteTypeDottedName(parts: string[]): string {
    if (!parts || parts.length === 0) return '';
    return parts.map(part => QuoteUtils.quoteIdentifierTypeName(part)).join('.');
}
```

### Examples

| Input Parts | Output |
|-------------|--------|
| `['json']` | `json` |
| `['myschema', 'json']` | `myschema.json` |
| `['custom', 'int']` | `custom.int` |
| `['myapp', 'boolean']` | `myapp.boolean` |
| `['myschema', 'select']` | `myschema."select"` |

### When to Use Type-Name Quoting

Use `quoteTypeDottedName()` in the `TypeName` handler for non-pg_catalog types. This ensures that user-defined types with keyword names are emitted with minimal quoting.

## Composition Helpers

### quoteDottedName(parts: string[])

This helper applies the appropriate quoting policy to each part of a dotted name:

- **First part**: Uses strict quoting (`quoteIdentifier()`) because the leading identifier often appears in less-permissive grammar slots
- **Subsequent parts**: Uses relaxed quoting (`quoteIdentifierAfterDot()`) because they appear after dots in permissive slots

```typescript
static quoteDottedName(parts: string[]): string {
    if (!parts || parts.length === 0) return '';
    if (parts.length === 1) {
        return QuoteUtils.quoteIdentifier(parts[0]);
    }
    return parts.map((part, index) => 
        index === 0 
            ? QuoteUtils.quoteIdentifier(part) 
            : QuoteUtils.quoteIdentifierAfterDot(part)
    ).join('.');
}
```

### Examples

| Input Parts | Output |
|-------------|--------|
| `['mytable']` | `mytable` |
| `['myschema', 'mytable']` | `myschema.mytable` |
| `['faker', 'float']` | `faker.float` |
| `['pg_catalog', 'substring']` | `pg_catalog.substring` |
| `['select', 'from']` | `"select".from` |
| `['MySchema', 'MyTable']` | `"MySchema"."MyTable"` |

### quoteQualifiedIdentifier(qualifier, ident)

A convenience wrapper for two-part qualified names:

```typescript
static quoteQualifiedIdentifier(
    qualifier: string | null | undefined, 
    ident: string
): string {
    if (qualifier) {
        return `${QuoteUtils.quoteIdentifier(qualifier)}.${QuoteUtils.quoteIdentifierAfterDot(ident)}`;
    }
    return QuoteUtils.quoteIdentifier(ident);
}
```

## Deparser Integration Rules

### The Problem with the String Visitor

The deparser's `String` visitor processes individual string nodes from the AST. It cannot reliably determine whether a string is:
- A standalone identifier (needs strict quoting)
- Part of a qualified name (first part needs strict, rest needs relaxed)
- A string literal (needs single-quote escaping, not identifier quoting)

Therefore, **dotted-name quoting must be done at the call sites that have the list of parts**, not in the String visitor.

### Anti-Pattern: Don't Do This

```typescript
// WRONG: This applies per-part quoting without slot context
const name = funcname.map(n => this.visit(n, context)).join('.');
```

This pattern sends each part through the String visitor, which uses strict quoting for all parts. The result is over-quoted output like `faker."float"`.

### Correct Pattern: Do This Instead

```typescript
// CORRECT: Extract raw string parts and use quoteDottedName
const funcnameParts = funcname.map((n: any) => 
    n.String?.sval || n.String?.str || ''
).filter((s: string) => s);
const name = QuoteUtils.quoteDottedName(funcnameParts);
```

This extracts the raw string values and applies the correct quoting policy per position.

### Where to Apply quoteDottedName

The following AST node handlers should use `quoteDottedName()` for their name components:

| Handler | Field | Description |
|---------|-------|-------------|
| `FuncCall` | `funcname` | Function name (e.g., `pg_catalog.substring`) |
| `CreateFunctionStmt` | `funcname` | Function being created |
| `ColumnRef` | `fields` | Column reference (e.g., `t.column`) |
| `RangeVar` | `catalogname`, `schemaname`, `relname` | Table reference |
| `TypeName` | `names` | Type name (e.g., `pg_catalog.int4`) |
| `CollateClause` | `collname` | Collation name |

### The quoteIfNeeded Helper

The `deparser.ts` file contains a `quoteIfNeeded()` method that routes to `QuoteUtils.quoteIdentifier()`. This is the strict quoting policy and should be used for standalone identifiers, not for dotted-name tails.

## String Comparison Pitfall

When the deparser needs to check for specific function names (e.g., to apply special SQL syntax for `pg_catalog.substring`), comparisons should be done carefully.

### Potential Issue

If you compare against the quoted output:

```typescript
const name = QuoteUtils.quoteDottedName(funcnameParts);
if (name === 'pg_catalog.substring') {  // This works because neither part needs quoting
    // Special handling
}
```

This works for `pg_catalog.substring` because neither `pg_catalog` nor `substring` requires quoting. But it would fail for a hypothetical `pg_catalog.Select` because the output would be `pg_catalog."Select"`.

### Recommended Approach

For robustness, compare against the raw parts before quoting:

```typescript
const funcnameParts = funcname.map((n: any) => n.String?.sval || '');
if (funcnameParts.length === 2 && 
    funcnameParts[0] === 'pg_catalog' && 
    funcnameParts[1] === 'substring') {
    // Special handling
}
```

Or create a helper that normalizes for comparison:

```typescript
const rawName = funcnameParts.join('.');  // Unquoted for comparison
if (rawName === 'pg_catalog.substring') {
    // Special handling
}
```

## Keyword Table Accuracy

The correctness of the strict quoting algorithm depends on the accuracy of the keyword table in `kwlist.ts`. This table must match PostgreSQL's keyword classifications for the target PostgreSQL version.

If the keyword table diverges from upstream PostgreSQL:
- Keywords missing from the table may be emitted unquoted when they should be quoted
- Keywords with incorrect categories may be quoted unnecessarily or insufficiently

When updating to support new PostgreSQL versions, ensure `kwlist.ts` is synchronized with PostgreSQL's `kwlist.h`.

## Summary: Which Function to Use

| Scenario | Function | Example |
|----------|----------|---------|
| Standalone identifier | `quoteIdentifier()` | Column name in SELECT list |
| Dotted name (multi-part) | `quoteDottedName()` | `schema.table`, `schema.function` |
| Two-part qualified name | `quoteQualifiedIdentifier()` | `schema.table` |
| After-dot component only | `quoteIdentifierAfterDot()` | Indirection field access |
| Type name (single or multi-part) | `quoteTypeDottedName()` | `myschema.json`, `custom.int` |
| Type name component only | `quoteIdentifierTypeName()` | Type name part |
| String literal | `escape()` or `formatEString()` | String values in SQL |

## Test Fixtures

The quoting behavior is verified by test fixtures in `__fixtures__/kitchen-sink/pretty/`:

- `quoting-1.sql` through `quoting-7.sql`: Test cases for `faker.float`, `faker.interval`, `faker.boolean`, and `pg_catalog.substring`
- `quoting-8.sql` through `quoting-13.sql`: Test cases for type casts with `json`, `jsonb`, `boolean`, `interval`, `int`
- `quoting-14.sql` through `quoting-16.sql`: Test cases for user-defined schema-qualified types with keyword names (`myschema.json`, `custom.int`, `myapp.boolean`)

The corresponding snapshots in `__tests__/pretty/__snapshots__/quoting-pretty.test.ts.snap` demonstrate the expected output with minimal quoting.

## References

- PostgreSQL `quote_identifier()`: [ruleutils.c](https://github.com/postgres/postgres/blob/master/src/backend/utils/adt/ruleutils.c)
- PostgreSQL keyword list: [kwlist.h](https://github.com/postgres/postgres/blob/master/src/include/parser/kwlist.h)
- PostgreSQL documentation on identifiers: [SQL Syntax - Lexical Structure](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)
