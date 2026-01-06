# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.5.2](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.5.1...plpgsql-deparser@0.5.2) (2026-01-06)

### Bug Fixes

- **plpgsql-deparser:** handle = assignment operator in splitAssignment ([cbbc4ac](https://github.com/constructive-io/pgsql-parser/commit/cbbc4ac4f77493bf5ac539828f35229d915d9bb4))

## [0.5.1](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.5.0...plpgsql-deparser@0.5.1) (2026-01-06)

### Bug Fixes

- **plpgsql-deparser:** handle already hydrated expressions in hydrateExpression ([2b24932](https://github.com/constructive-io/pgsql-parser/commit/2b249324c6311e3211d1a627d1d872ed70e1ab90))

# [0.5.0](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.4.2...plpgsql-deparser@0.5.0) (2026-01-05)

### Features

- **plpgsql-deparser:** enable heterogeneous deparse for AST-based transformations ([e6383c9](https://github.com/constructive-io/pgsql-parser/commit/e6383c90db389fdb80e456cb54b30121e7ef436d))

## [0.4.2](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.4.1...plpgsql-deparser@0.4.2) (2026-01-05)

**Note:** Version bump only for package plpgsql-deparser

## [0.4.1](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.4.0...plpgsql-deparser@0.4.1) (2026-01-03)

### Bug Fixes

- **plpgsql-deparser:** indent all lines of multi-line statements ([36dd819](https://github.com/constructive-io/pgsql-parser/commit/36dd819c39fb193fbc90797bba7d144beae0bdbe))

# [0.4.0](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.3.0...plpgsql-deparser@0.4.0) (2026-01-01)

### Features

- **plpgsql-deparser:** add DehydrationOptions to thread SQL deparse options ([1278b39](https://github.com/constructive-io/pgsql-parser/commit/1278b391534f4627997b09db909b143984d4c24b))
- **plpgsql-deparser:** deparse modified AST for sql-stmt kind ([070f9a0](https://github.com/constructive-io/pgsql-parser/commit/070f9a0013cbc3f260f99c375070ad01fcf161b8))

# [0.3.0](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.2.1...plpgsql-deparser@0.3.0) (2025-12-31)

### Features

- **deparser:** add pretty printing for CREATE FUNCTION params and RETURNS TABLE ([9dda8d1](https://github.com/constructive-io/pgsql-parser/commit/9dda8d1bf8c9d18a82ad3e462d93edb93e8662eb))
- **plpgsql-deparser:** add dehydratePlpgsqlAst and demo test ([b530f17](https://github.com/constructive-io/pgsql-parser/commit/b530f17c0f80b0a82bcc1ea6d86a83661293c56e))
- **plpgsql-deparser:** add hydratePlpgsqlAst for parsing embedded SQL expressions ([c8e23a1](https://github.com/constructive-io/pgsql-parser/commit/c8e23a110640d55f74c0e5b1d0145eab831cafff))
- **plpgsql-deparser:** include full CREATE FUNCTION in hydrate demo ([c1698f9](https://github.com/constructive-io/pgsql-parser/commit/c1698f9b39569e4f3890361c89123bb9400b34e1))

## [0.2.1](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.2.0...plpgsql-deparser@0.2.1) (2025-12-31)

**Note:** Version bump only for package plpgsql-deparser

# 0.2.0 (2025-12-31)

### Bug Fixes

- improve loop variable handling and add plpgsql-pretty snapshot tests ([89a0621](https://github.com/constructive-io/pgsql-parser/commit/89a0621a00ed17c1415e508ff3b2418f18abd5d1))

### Features

- add fixture generation and round-trip testing for plpgsql-deparser ([7354e55](https://github.com/constructive-io/pgsql-parser/commit/7354e55d8387e6e4132c9ff8fdc4881bb042b4f1))
- add fixture pipeline using @libpg-query/parser for plpgsql-deparser ([7c4d752](https://github.com/constructive-io/pgsql-parser/commit/7c4d7525ca1ecfeef3ff22f8f393b35f9afd6472))
- scaffold plpgsql-deparser package for PL/pgSQL AST deparsing ([426f297](https://github.com/constructive-io/pgsql-parser/commit/426f297d9d17e0b2abadf5182d2723f05c3fbdfa))
