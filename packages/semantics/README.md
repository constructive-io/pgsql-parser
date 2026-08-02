# @pgsql/semantics

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE-MIT"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
   <a href="https://www.npmjs.com/package/@pgsql/semantics"><img height="20" src="https://img.shields.io/github/package-json/v/constructive-io/pgsql-parser?filename=packages%2Fsemantics%2Fpackage.json"/></a>
</p>

AST-derived **semantic facts** for PostgreSQL statements: given a SQL script,
extract what each statement *is*, what it *creates*, and what it *references* —
including references reached inside PL/pgSQL function bodies (via `plpgsql-parser`
hydration). Read-only: the input is never modified.

This is the fact-extraction layer that grew up inside [`@pgsql/transform`](../transform).
It extracts *semantics* (which relations/functions/types a statement reads and
creates, which namespaces it touches), independent of any transformation.
`@pgsql/transform` re-exports the same symbols, so existing consumers are
unaffected.

## Installation

```bash
npm install @pgsql/semantics
```

The parser runs on a WASM build of the real PostgreSQL parser; call `loadModule()`
from `plpgsql-parser` once before using any synchronous API.

## Usage

```typescript
import { loadModule } from 'plpgsql-parser';
import { classifyStatements } from '@pgsql/semantics';

await loadModule();

const facts = classifyStatements(sql);
// per statement: kind (schema|table|view|index|type|function|trigger|policy|grant|...),
// creates, references (incl. inside PL/pgSQL bodies), bodyReferences,
// referencedSchemas, roles, fkTargets, extension, securityRelevant,
// securityDefiner, dynamicSql, span, stmt
```

## Exports

- `classifyStatements(sql)` — classify each top-level statement into `StatementFacts[]`.
- Types: `StatementFacts`, `StatementKind`, `QualifiedName`, `ExtensionFact`, `ExtensionAction`, `StatementSpan`.
