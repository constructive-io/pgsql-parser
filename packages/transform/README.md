# @pgsql/transform

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE-MIT"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
   <a href="https://www.npmjs.com/package/@pgsql/transform"><img height="20" src="https://img.shields.io/github/package-json/v/constructive-io/pgsql-parser?filename=packages%2Ftransform%2Fpackage.json"/></a>
</p>

AST-based SQL transformation, qualification, classification, and dependency-closure analysis for PostgreSQL. Works on plain SQL **and inside PL/pgSQL function bodies** (via `plpgsql-parser` hydration) — no regexes.

> Looking for the PG13→17/18 version-upgrade AST transformer previously published under this name? It now lives at [`@pgsql/transform-ast`](../transform-ast).

## Installation

```bash
npm install @pgsql/transform
```

The parser runs on a WASM build of the real PostgreSQL parser; call `loadModule()` from `plpgsql-parser` once before using any synchronous API.

## Features

### `transformSql` — schema-name rewriting

Rewrite schema names everywhere they can appear (DDL, DML, function bodies, trigger definitions, grants, policies, comments, type casts, string-embedded types inside PL/pgSQL, ...):

```typescript
import { loadModule } from 'plpgsql-parser';
import { transformSql } from '@pgsql/transform';

await loadModule();
const mapping = new Map([['my-schema', 'my_schema']]);
const { sql } = transformSql(inputSql, mapping);
```

### `classifyStatements` — per-statement AST facts

```typescript
import { classifyStatements } from '@pgsql/transform';

const facts = classifyStatements(sql);
// per statement: kind (schema|table|view|index|type|function|trigger|policy|grant|...),
// creates, references (incl. inside PL/pgSQL bodies), referencedSchemas, roles,
// fkTargets, securityRelevant, securityDefiner, dynamicSql
```

### `qualifyUnqualified` — add schema qualification

Qualify unqualified object references against an inventory of known objects, with multi-schema routing support.

### `resolveFixtureClosure` — transitive dependency closure

Given a set of changes (name + SQL + optional declared dependencies), compute the transitive closure of a selection: forward producers of every referenced object/schema/role, plus attached fixtures (policies/grants/RLS targeting closure members), with explicit unresolved-reference reporting.

### `categorizeChange` / `buildCategoryOf` — change categorization

Profile-driven categorization of migration changes (e.g. schema / functionality / security / fixtures) from their AST facts.

### Round-trip validation

`normalizeTree` / `cleanTree` / `validateRoundTrip` — dependency-free AST normalization and mutation-aware parse→deparse→re-parse validation.

## Scripts

- `npm run fixtures` — regenerate `__fixtures__/output/` golden files from `__fixtures__/input/`
- `npm run scan-corpus <dir> [dir...]` — audit node-type coverage over a SQL corpus
