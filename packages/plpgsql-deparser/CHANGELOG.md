# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.7.3](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.7.2...plpgsql-deparser@0.7.3) (2026-01-23)

### Bug Fixes

- normalize whitespace after INTO clause insertion ([6cfb699](https://github.com/constructive-io/pgsql-parser/commit/6cfb699fc7df8d4479233ff86c300b3ad1b5c547))
- update pretty test snapshots for whitespace normalization ([f9012e0](https://github.com/constructive-io/pgsql-parser/commit/f9012e03f517e9bfbf017f62f6ffc471709ca9cb))

## [0.7.2](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.7.1...plpgsql-deparser@0.7.2) (2026-01-13)

**Note:** Version bump only for package plpgsql-deparser

## [0.7.1](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.7.0...plpgsql-deparser@0.7.1) (2026-01-08)

### Bug Fixes

- **plpgsql-deparser:** use QuoteUtils for schema-qualified type names ([cd117b6](https://github.com/constructive-io/pgsql-parser/commit/cd117b6d1df18de732873dcbf9ce7ec13efa71cf))

# [0.7.0](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.6.2...plpgsql-deparser@0.7.0) (2026-01-08)

### Features

- **plpgsql-deparser:** add PLpgSQL_type hydration support ([42ac2e2](https://github.com/constructive-io/pgsql-parser/commit/42ac2e28fe3284049045a7596928e791b7491b2e))

## [0.6.2](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.6.1...plpgsql-deparser@0.6.2) (2026-01-07)

### Bug Fixes

- **plpgsql-deparser:** filter out implicit sqlstate/sqlerrm variables ([aec8d3d](https://github.com/constructive-io/pgsql-parser/commit/aec8d3dc608e6b22d7f6337469fb106c41160265))
- **plpgsql-deparser:** fix 2 more failing fixtures (189/190 now pass) ([707e36e](https://github.com/constructive-io/pgsql-parser/commit/707e36e7d8214ca9748f7b8fc621b334c40736ab))
- **plpgsql-deparser:** fix EXCEPTION block handling in deparser ([64c900c](https://github.com/constructive-io/pgsql-parser/commit/64c900c001818867026225f81b7068bc1d939a6e))
- **plpgsql-deparser:** preserve schema qualification in %rowtype/%type references ([13cff51](https://github.com/constructive-io/pgsql-parser/commit/13cff5116616464ded51df21c28d2d61383aefbe))
- **plpgsql-deparser:** support nested DECLARE blocks inside FOR loops ([4029221](https://github.com/constructive-io/pgsql-parser/commit/402922177ff159b8cdf8652fcdfdd9dc9066f571))
- **test-utils:** filter out varno values during AST comparison ([9d79484](https://github.com/constructive-io/pgsql-parser/commit/9d79484b92b4482d17dc51ace93f99f906602d57))

## [0.6.1](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.6.0...plpgsql-deparser@0.6.1) (2026-01-06)

**Note:** Version bump only for package plpgsql-deparser

# [0.6.0](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.5.4...plpgsql-deparser@0.6.0) (2026-01-06)

### Features

- **plpgsql-deparser:** add context-based RETURN statement handling ([d8360b6](https://github.com/constructive-io/pgsql-parser/commit/d8360b62db4176aa21bad22d63c15fe58435345f))

## [0.5.4](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.5.3...plpgsql-deparser@0.5.4) (2026-01-06)

### Bug Fixes

- **plpgsql-deparser:** fix PERFORM, INTO, and recfield bugs ([f791150](https://github.com/constructive-io/pgsql-parser/commit/f791150696d703e591afc3411886d598d51ecff1))
- **plpgsql-deparser:** normalize whitespace after INTO insertion ([2769aa6](https://github.com/constructive-io/pgsql-parser/commit/2769aa67f12047abd9dee38ef0a350f2613f15c5))

## [0.5.3](https://github.com/constructive-io/pgsql-parser/compare/plpgsql-deparser@0.5.2...plpgsql-deparser@0.5.3) (2026-01-06)

### Bug Fixes

- **plpgsql-deparser:** expand PLpgSQL_row fields when refname is '(unnamed row)' ([eec5a55](https://github.com/constructive-io/pgsql-parser/commit/eec5a55d24282868836daade8ab38e631acb7bb0))

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
