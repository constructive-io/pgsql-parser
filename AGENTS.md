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
| `pgsql-types` | `packages/pgsql-types` | Narrowed TypeScript types inferred from SQL fixtures |
| `@pgsql/types` | (published from proto-parser codegen) | Core TypeScript type definitions for PostgreSQL AST nodes |
| `@pgsql/utils` | `packages/utils` | Type-safe AST node creation utilities |
| `@pgsql/traverse` | `packages/traverse` | Visitor-pattern AST traversal |
| `@pgsql/transform` | `packages/transform` | Multi-version AST transformer (PG 13-17) |
| `@pgsql/quotes` | `packages/quotes` | SQL identifier/string quoting and keyword classification |
| `@pgsql/cli` | `packages/pgsql-cli` | CLI tool for parse/deparse operations |
| `pg-proto-parser` | `packages/proto-parser` | Generate TypeScript from PostgreSQL protobuf definitions |
| `pg-ast` | `packages/pg-ast` | Low-level AST helpers |

## Setup

```bash
pnpm install
pnpm run build    # builds all packages (includes code generation)
pnpm run test     # runs all package tests
pnpm run lint     # lints all packages
```

## Skills

Detailed workflow documentation lives in `.agents/skills/`:

| Skill | Path | Covers |
|-------|------|--------|
| **Testing & Fixtures** | `.agents/skills/testing-fixtures/SKILL.md` | Fixture-based testing pipeline, adding new test fixtures, kitchen-sink workflow, PL/pgSQL fixtures, transform tests |
| **Code Generation** | `.agents/skills/code-generation/SKILL.md` | Protobuf codegen (`build:proto`), type inference/generation (`pgsql-types`), keyword generation (`@pgsql/quotes`), version-specific deparsers |

## Root Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `pnpm -r run build` | Build all packages (TypeScript compilation + code generation) |
| `clean` | `pnpm -r run clean` | Clean all package `dist/` directories |
| `test` | `pnpm -r run test` | Run Jest tests across all packages |
| `lint` | `pnpm -r run lint` | ESLint with auto-fix across all packages |
| `deps` | `pnpm up -r -i -L` | Interactive dependency update across workspace |
| `bump-versions` | `ts-node scripts/bump-versions.ts` | Interactive version bumper — fetches latest npm versions, prompts for bump type per PG version |
| `update-workspace` | `makage update-workspace` | Update pnpm workspace configuration |

## Per-Package Standard Scripts

Every package supports these scripts:

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc && tsc -p tsconfig.esm.json` + extras | TypeScript compilation (CJS + ESM) + asset copy. Some packages run `build:proto` first |
| `build:dev` | Same as build but with `--declarationMap` | Development build with source maps for declaration files |
| `clean` | `makage clean dist` | Remove `dist/` directory |
| `copy` | `makage assets` | Copy non-TS assets to `dist/` |
| `lint` | `eslint . --fix` | ESLint with auto-fix |
| `test` | `jest` | Run Jest tests |
| `test:watch` | `jest --watch` | Run Jest in watch mode |
| `prepublishOnly` | `npm run build` | Ensure build before publish |

## Package-Specific Scripts

### Fixture & Testing Scripts (see testing-fixtures skill)

| Package | Script | Description |
|---------|--------|-------------|
| `deparser` | `npm run kitchen-sink` | Regenerate fixtures + test files (most common command) |
| `deparser` | `npm run fixtures` | Regenerate `generated.json` only |
| `deparser` | `npm run fixtures:kitchen-sink` | Regenerate test files only |
| `deparser` | `npm run fixtures:ast` | Generate AST JSON fixtures |
| `deparser` | `npm run fixtures:sql` | Generate SQL fixtures via native deparse |
| `deparser` | `npm run fixtures:upstream-diff` | Compare upstream (libpg-query) vs our deparser output |
| `plpgsql-deparser` | `npm run fixtures` | Extract PL/pgSQL fixtures |
| `transform` | `npm run kitchen-sink` | Generate transform kitchen-sink tests |
| `transform` | `npm run test:ast` | AST round-trip validation |
| `parser` | `npm run test:ast` | AST round-trip validation |

### Code Generation Scripts (see code-generation skill)

| Package | Script | Description |
|---------|--------|-------------|
| `utils` | `npm run build:proto` | Generate AST helpers from protobuf |
| `traverse` | `npm run build:proto` | Generate traversal utilities from protobuf |
| `transform` | `npm run build:proto` | Generate transformer utilities from protobuf |
| `pg-ast` | `npm run build:proto` | Generate AST types from protobuf |
| `pgsql-types` | `npm run infer` | Infer field metadata from SQL fixtures |
| `pgsql-types` | `npm run generate` | Generate narrowed types from metadata |
| `proto-parser` | `npm run generate:test-utils` | Generate test utilities from protobuf |
| `quotes` | `npm run keywords` | Generate keyword list from PostgreSQL `kwlist.h` |

### Version Management

| Package | Script | Description |
|---------|--------|-------------|
| `parser` | `npm run prepare-versions` | Generate version-specific sub-packages from `config/versions.json` |
| (root) | `npm run bump-versions` | Interactive CLI to bump `pgsql-parser` / `pgsql-deparser` versions per PG version |

Version configuration lives in `config/versions.json` — maps PG versions (13-17) to their `libpg-query`, `pgsql-parser`, `pgsql-deparser`, and `@pgsql/types` versions plus npm dist-tags.

### CLI Development

| Package | Script | Description |
|---------|--------|-------------|
| `pgsql-cli` | `npm run dev` | Run CLI in dev mode via `ts-node src/index` |

## Code Conventions

- TypeScript throughout, compiled to both CJS and ESM
- `@pgsql/types` provides all AST node types — use them for type safety
- `@pgsql/quotes` handles SQL identifier quoting — use `QuoteUtils` methods
- Test files go in `__tests__/` within each package
- Fixture SQL files go in `__fixtures__/kitchen-sink/` (see testing-fixtures skill)
- Generated files (marked `DO NOT EDIT BY HAND`) should be regenerated via scripts, not edited manually
