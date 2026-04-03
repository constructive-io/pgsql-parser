# AGENTS.md — pgsql-parser

## Project Overview

A pnpm monorepo for PostgreSQL AST parsing, deparsing, and code generation. All packages live in `packages/`.

## Key Packages

| Package | Directory | Purpose |
|---------|-----------|---------|
| `pgsql-parser` | `packages/parser` | Parse SQL to AST (wraps `libpg-query` WASM) |
| `pgsql-deparser` | `packages/deparser` | Convert AST back to SQL (pure TypeScript) |
| `plpgsql-parser` | `packages/plpgsql-parser` | Parse PL/pgSQL to AST |
| `plpgsql-deparser` | `packages/plpgsql-deparser` | Convert PL/pgSQL AST back to SQL |
| `@pgsql/types` | `packages/pgsql-types` | TypeScript type definitions for PostgreSQL AST nodes |
| `@pgsql/utils` | `packages/utils` | Type-safe AST node creation utilities |
| `@pgsql/traverse` | `packages/traverse` | Visitor-pattern AST traversal |
| `@pgsql/transform` | `packages/transform` | Multi-version AST transformer (PG 13→17) |
| `@pgsql/quotes` | `packages/quotes` | SQL identifier/string quoting utilities |
| `@pgsql/cli` | `packages/pgsql-cli` | CLI tool for parse/deparse operations |
| `pg-proto-parser` | `packages/proto-parser` | Generate TypeScript from PostgreSQL protobuf definitions |
| `pg-ast` | `packages/pg-ast` | Low-level AST types |

## Setup

```bash
pnpm install
pnpm run build    # builds all packages
pnpm run test     # runs all package tests
pnpm run lint     # lints all packages
```

## Per-Package Commands

Each package supports:
- `npm run build` — TypeScript compilation (CJS + ESM) + asset copy
- `npm run test` — Jest tests
- `npm run lint` — ESLint with auto-fix
- `npm run test:watch` — Jest in watch mode

## Testing

Tests use Jest. The deparser packages use a **fixture-based testing system** — see `.agents/skills/testing-fixtures/SKILL.md` for full details.

Quick reference:
```bash
cd packages/deparser
npm run kitchen-sink   # regenerate fixtures + test files
npx jest               # run all tests
```

## Code Conventions

- TypeScript throughout, compiled to both CJS and ESM
- `@pgsql/types` provides all AST node types — use them for type safety
- `@pgsql/quotes` handles SQL identifier quoting — use `QuoteUtils` methods
- Test files go in `__tests__/` within each package
- Fixture SQL files go in `__fixtures__/kitchen-sink/` (see skills for details)
