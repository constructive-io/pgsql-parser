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

`@pgsql/transform` is a TypeScript library for transforming PostgreSQL ASTs between different PostgreSQL versions. It serves as a crucial component for building a single source of truth deparser that can handle SQL from multiple PostgreSQL versions while maintaining backward compatibility.

## Transforming ASTs Between PG Versions

The transform package enables you to:

- **Transform legacy ASTs**: Convert ASTs from PostgreSQL versions 13-16 to version 17
- **Build unified deparsers**: Create a single deparser pipeline that works with multiple PostgreSQL versions
- **Maintain backward compatibility**: Support legacy codebases while leveraging the latest PostgreSQL features

## Key Limitation

This package only supports ASTs derived from SQL that is parseable by PostgreSQL 17. This means:

- ✅ **Supported**: SQL from PG13-16 that remains valid in PG17
- ❌ **Not supported**: Deprecated syntax from older versions that was removed
- ❌ **Not supported**: SQL that cannot be parsed by the PG17 parser

This design ensures all transformed ASTs can be reliably deparsed using the latest PostgreSQL grammar.

## Installation

```bash
npm install @pgsql/transform
```

## 🚀 Quick Start

### Multi-Version Transformer

```typescript
import { ASTTransformer } from '@pgsql/transform';

const transformer = new ASTTransformer();

// Transform any version to PG17
const pg17Ast = transformer.transformToLatest(pg13Ast, 13);

// Transform between specific versions
const pg15Ast = transformer.transform(pg13Ast, 13, 15);

// Convenience methods
const result = transformer.transform13To17(pg13Ast);
```

### Direct Transformers

For better performance when you know source and target versions:

```typescript
import { PG13ToPG17Transformer } from '@pgsql/transform';

const transformer = new PG13ToPG17Transformer();
const pg17Ast = transformer.transform(pg13Ast);
```

### Integration Example

```typescript
import { parse } from '@pgsql/parser';
import { deparse } from 'pgsql-deparser';
import { PG13ToPG17Transformer } from '@pgsql/transform';

// Parse with older version
const pg13Ast = await parse('SELECT * FROM users', { version: 13 });

// Transform to latest
const transformer = new PG13ToPG17Transformer();
const pg17Ast = transformer.transform(pg13Ast);

// Deparse with latest grammar
const sql = await deparse(pg17Ast);
```

## 🔄 Transformation Chain

**Incremental**: PG13 → PG14 → PG15 → PG16 → PG17
- Step-by-step version upgrades
- Useful for debugging transformation issues

**Direct**: PG13 → PG17, PG14 → PG17, etc.
- Single-step transformations
- Optimized for performance

## 📋 Supported Transformations

| From | To | Transformer |
|------|----|-----------| 
| PG13 | PG14, PG15, PG16, PG17 | `V13ToV14Transformer`, `PG13ToPG17Transformer` |
| PG14 | PG15, PG16, PG17 | `V14ToV15Transformer`, `PG14ToPG17Transformer` |
| PG15 | PG16, PG17 | `V15ToV16Transformer`, `PG15ToPG17Transformer` |
| PG16 | PG17 | `V16ToV17Transformer`, `PG16ToPG17Transformer` |

## 🏗️ Architecture

The transform package fits into the broader pgsql-parser ecosystem:

1. **Parse** legacy SQL with version-specific parsers
2. **Transform** ASTs to the latest version
3. **Deparse** using the unified, latest-version deparser

This enables a single source of truth for SQL generation while supporting legacy codebases.