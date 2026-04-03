# Code Generation & Type Inference

This skill documents the code generation pipelines in pgsql-parser: protobuf-based TypeScript generation, type inference from SQL fixtures, and keyword list generation from PostgreSQL source.

## Overview

Several packages generate TypeScript code from external sources rather than being hand-written. These generated files should **not** be edited by hand — instead, re-run the generation scripts after changing inputs.

## 1. Protobuf-Based Code Generation (`build:proto`)

Four packages generate TypeScript from the PostgreSQL protobuf definition at `__fixtures__/proto/17-latest.proto`:

| Package | Script | What it generates |
|---------|--------|-------------------|
| `@pgsql/utils` | `npm run build:proto` | AST helper functions (`src/`), wrapped helpers (`wrapped.ts`), runtime schema (`runtime-schema.ts`) |
| `@pgsql/traverse` | `npm run build:proto` | Visitor-pattern traversal utilities |
| `@pgsql/transform` | `npm run build:proto` | Multi-version AST transformer utilities |
| `pg-ast` | `npm run build:proto` | Low-level AST type helpers |

Each package has a `scripts/pg-proto-parser.ts` that configures `PgProtoParser` with package-specific options (which features to enable, output paths, type sources).

**When to re-run:** After updating `__fixtures__/proto/17-latest.proto` (e.g., when upgrading to a new PostgreSQL version).

```bash
# Re-generate for a specific package
cd packages/utils && npm run build:proto

# Or build all (build:proto runs as part of build)
pnpm run build
```

Note: `build:proto` is called automatically as part of `npm run build` in these packages, so a full `pnpm run build` from root covers everything.

### Proto-Parser Test Utils

The `pg-proto-parser` package also has its own generation script:

```bash
cd packages/proto-parser && npm run generate:test-utils
```

This generates test utility functions from a `13-latest.proto` fixture into `test-utils/utils/`.

## 2. Type Inference & Narrowed Type Generation (`pgsql-types`)

The `pgsql-types` package has a two-step pipeline that discovers actual AST usage patterns from SQL fixtures and generates narrowed TypeScript types:

### Step 1: Infer field metadata

```bash
cd packages/pgsql-types && npm run infer
```

Runs `scripts/infer-field-metadata.ts`:
- Reads all `.sql` files from `__fixtures__/kitchen-sink/` and `__fixtures__/postgres/`
- Parses each statement and walks the AST
- For every `Node`-typed field, records which concrete node tags actually appear
- Writes `src/field-metadata.json` with nullable/tag/array info per field

### Step 2: Generate narrowed types

```bash
cd packages/pgsql-types && npm run generate
```

Runs `scripts/generate-types.ts`:
- Reads `src/field-metadata.json` (must run `infer` first)
- Generates `src/types.ts` with narrowed union types instead of generic `Node`
- Example: instead of `whereClause?: Node`, generates `whereClause?: { BoolExpr: BoolExpr } | { A_Expr: A_Expr } | ...`

**When to re-run:** After adding new SQL fixtures (which may introduce new node type combinations) or after updating the runtime schema.

Note: `infer` is called automatically as part of `npm run build` in pgsql-types.

## 3. Keyword List Generation (`@pgsql/quotes`)

```bash
cd packages/quotes && npm run keywords -- /path/to/postgres/src/include/parser/kwlist.h
```

Runs `scripts/keywords.ts`:
- Reads PostgreSQL's `kwlist.h` header file (from a local PostgreSQL source checkout)
- Parses `PG_KEYWORD(...)` macros to extract keywords and their categories
- Generates `src/kwlist.ts` with typed keyword sets (RESERVED, UNRESERVED, COL_NAME, TYPE_FUNC_NAME)

**When to re-run:** When upgrading to a new PostgreSQL version that adds/removes/reclassifies keywords.

**Requires:** A local checkout of the PostgreSQL source code to provide the `kwlist.h` file. The script will prompt for the path interactively if not provided as an argument.

## 4. Version-Specific Deparser Generation (`pgsql-deparser`)

```bash
cd packages/deparser && ts-node scripts/generate-version-deparsers.ts
```

Generates `versions/{13,14,15,16}/src/index.ts` files that wire up version-specific AST transformers (e.g., `PG13ToPG17Transformer`) to the main v17 deparser. This allows deparsing ASTs from older PostgreSQL versions.

**When to re-run:** When adding support for a new PostgreSQL version or changing the transformer class names.

## Quick Reference

| Workflow | Command | Input | Output |
|----------|---------|-------|--------|
| Proto codegen (all) | `pnpm run build` | `__fixtures__/proto/17-latest.proto` | Generated TS in each package's `src/` |
| Proto codegen (one pkg) | `cd packages/<pkg> && npm run build:proto` | Same | Same |
| Type inference | `cd packages/pgsql-types && npm run infer` | `__fixtures__/kitchen-sink/**/*.sql` | `src/field-metadata.json` |
| Type generation | `cd packages/pgsql-types && npm run generate` | `src/field-metadata.json` | `src/types.ts` |
| Keyword generation | `cd packages/quotes && npm run keywords -- <kwlist.h>` | PostgreSQL `kwlist.h` | `src/kwlist.ts` |
| Version deparsers | `cd packages/deparser && ts-node scripts/generate-version-deparsers.ts` | Transformer configs | `versions/*/src/index.ts` |
