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

### Round-trip validation

`normalizeTree` / `cleanTree` / `validateRoundTrip` — dependency-free AST normalization and mutation-aware parse→deparse→re-parse validation.

## Relationship to `@pgsql/traverse`

This package owns **policy**, not traversal. Every entry point above parses once,
then drives `walk` from `@pgsql/traverse` over the parsed script — statements and
hydrated PL/pgSQL bodies alike — with a visitor built here:

| Concern | Lives here |
|---|---|
| Which schema/role/extension a name maps to | `SchemaRouter`, `RoleRouter`, extension routes |
| What counts as a reference, a creation, a security-relevant statement | `classifyStatements` |
| When an unqualified name should be qualified | `qualifyUnqualified` |
| Whether the rewritten SQL still parses to the same tree | `validateRoundTrip` |
| How to reach every node of a SQL or PL/pgSQL AST | **`@pgsql/traverse`** |

So mapping logic never moves into the walker, and traversal logic never moves in
here. Some passes keep per-statement state (CTE names in `qualifyUnqualified`,
per-statement facts in `classifyStatements`) and drive the `walkSqlAst` /
`walkPlpgsqlAst` primitives directly with a visitor per statement.

Consequence for contributors: `__fixtures__/output/` is the regression gate for
traversal changes made *anywhere* in the ecosystem. A walker change that alters
these golden files is a behavior change, not a refactor.

## Scripts

- `npm run fixtures` — regenerate `__fixtures__/output/` golden files from `__fixtures__/input/`
- `npm run scan-corpus <dir> [dir...]` — audit node-type coverage over a SQL corpus
