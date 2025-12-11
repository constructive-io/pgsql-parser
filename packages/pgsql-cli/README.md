# @pgsql/cli

<p align="center" width="100%">
  <img height="120" src="https://github.com/constructive-io/pgsql-parser/assets/545047/6440fa7d-918b-4a3b-8d1b-755d85de8bea" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

`@pgsql/cli` is a unified command-line interface for PostgreSQL AST operations, including parsing SQL to AST, deparsing AST back to SQL, and generating TypeScript definitions from PostgreSQL protobufs. It consolidates functionality from multiple packages into a single, easy-to-use CLI tool.

## Installation

```bash
npm install -g @pgsql/cli
```

## Features

- **Parse SQL to AST**: Convert PostgreSQL queries into Abstract Syntax Trees
- **Deparse AST to SQL**: Convert AST back into SQL queries
- **Generate TypeScript from Protobuf**: Create type-safe TypeScript definitions from PostgreSQL protobuf files
- **Download and Process Proto Files**: Fetch proto files from URLs and generate JavaScript
- **Runtime Schema Generation**: Generate runtime schemas for AST nodes
- **Unified Interface**: Single CLI tool for all PostgreSQL AST operations

## Quick Start

```bash
# Parse SQL to AST
pgsql parse query.sql

# Deparse AST back to SQL
pgsql deparse ast.json

# Generate TypeScript from protobuf
pgsql proto-gen --inFile pg_query.proto --outDir out --types --enums

# Download and process proto file
pgsql proto-fetch --url https://raw.githubusercontent.com/pganalyze/libpg_query/16-latest/protobuf/pg_query.proto --inFile pg_query.proto --outFile pg_query.js
```

## Commands

### `pgsql parse`

Parse SQL files into Abstract Syntax Trees (AST).

```bash
pgsql parse <sqlfile> [options]
```

#### Options

| Option              | Description                                          | Default    |
|---------------------|------------------------------------------------------|------------|
| `-o, --output`      | Output to file instead of stdout                     |            |
| `-f, --format`      | Output format: `json`, `pretty`                      | `pretty`   |
| `--pl`              | Parse as PL/pgSQL function only                      | `false`    |
| `--clean`           | Clean the AST tree (remove location info)            | `false`    |
| `-h, --help`        | Show help                                            |            |

#### Examples

```bash
# Parse SQL and output to console
pgsql parse query.sql

# Parse SQL and save to file
pgsql parse query.sql -o ast.json

# Parse PL/pgSQL function
pgsql parse function.sql --pl

# Parse and output compact JSON
pgsql parse query.sql --format json
```

### `pgsql deparse`

Convert AST back to SQL.

```bash
pgsql deparse [options]
```

#### Options

| Option              | Description                                          | Default    |
|---------------------|------------------------------------------------------|------------|
| `-i, --input`       | Input JSON file (or use stdin)                       |            |
| `-o, --output`      | Output to file instead of stdout                     |            |
| `-h, --help`        | Show help                                            |            |

#### Examples

```bash
# Deparse from file
pgsql deparse -i ast.json

# Deparse from stdin
cat ast.json | pgsql deparse

# Parse and deparse in one line
pgsql parse query.sql | pgsql deparse

# Deparse to file
pgsql deparse -i ast.json -o query.sql
```

### `pgsql proto-gen`

Generate TypeScript definitions from PostgreSQL protobuf files.

```bash
pgsql proto-gen --inFile <proto> --outDir <dir> [options]
```

#### Options

| Option                | Description                                          | Default    |
|-----------------------|------------------------------------------------------|------------|
| `--inFile`            | Input .proto file                                    | *Required* |
| `--outDir`            | Output directory                                     | *Required* |
| `--enums`             | Generate TypeScript enums                            | `false`    |
| `--enums-json`        | Generate JSON enum mappings                          | `false`    |
| `--types`             | Generate TypeScript interfaces                       | `false`    |
| `--utils`             | Generate utility functions                           | `false`    |
| `--ast-helpers`       | Generate AST helper methods                          | `false`    |
| `--wrapped-helpers`   | Generate wrapped AST helpers                         | `false`    |
| `--optional`          | Make all fields optional                             | `false`    |
| `--keep-case`         | Keep original field casing                           | `false`    |
| `--remove-undefined`  | Remove UNDEFINED enum at position 0                  | `false`    |
| `-h, --help`          | Show help                                            |            |

#### Examples

```bash
# Generate types and enums
pgsql proto-gen --inFile pg_query.proto --outDir out --types --enums

# Generate everything
pgsql proto-gen --inFile pg_query.proto --outDir out --types --enums --utils --ast-helpers

# Generate with optional fields
pgsql proto-gen --inFile pg_query.proto --outDir out --types --optional
```

### `pgsql proto-fetch`

Download and process proto files.

```bash
pgsql proto-fetch [options]
```

#### Options

| Option              | Description                                          | Default                        |
|---------------------|------------------------------------------------------|--------------------------------|
| `--url`             | Proto file URL to download                           |                                |
| `--inFile`          | Where to save the proto file                        | *Required*                     |
| `--outFile`         | Generated JS output file                             | *Required*                     |
| `--replace-pkg`     | Original package name to replace                     | `protobufjs/minimal`           |
| `--with-pkg`        | New package name                                     | `@launchql/protobufjs/minimal` |
| `-h, --help`        | Show help                                            |                                |

#### Examples

```bash
# Download and process proto file
pgsql proto-fetch \
  --url https://raw.githubusercontent.com/pganalyze/libpg_query/16-latest/protobuf/pg_query.proto \
  --inFile pg_query.proto \
  --outFile pg_query.js

# Process existing proto file
pgsql proto-fetch \
  --inFile pg_query.proto \
  --outFile pg_query.js \
  --replace-pkg "protobufjs/minimal" \
  --with-pkg "@custom/protobufjs"
```

### `pgsql runtime-schema`

Generate runtime schema for AST nodes.

```bash
pgsql runtime-schema --inFile <proto> --outDir <dir> [options]
```

#### Options

| Option              | Description                                          | Default           |
|---------------------|------------------------------------------------------|-------------------|
| `--inFile`          | Input .proto file                                    | *Required*        |
| `--outDir`          | Output directory                                     | *Required*        |
| `--format`          | Output format: `json`, `typescript`                  | `json`            |
| `--filename`        | Output filename (without extension)                  | `runtime-schema`  |
| `-h, --help`        | Show help                                            |                   |

#### Examples

```bash
# Generate JSON schema
pgsql runtime-schema --inFile pg_query.proto --outDir out

# Generate TypeScript schema
pgsql runtime-schema --inFile pg_query.proto --outDir out --format typescript

# Custom filename
pgsql runtime-schema --inFile pg_query.proto --outDir out --filename ast-schema
```

## Migration Guide

### Migrating from `pgsql-parser` CLI

If you were using the `pgsql-parser` command-line tool:

```bash
# Old
pgsql-parser file.sql
pgsql-parser file.sql --pl

# New
pgsql parse file.sql
pgsql parse file.sql --pl
```

### Migrating from `pg-proto-parser`

If you were using the `pg-proto-parser` command-line tool:

```bash
# Old
pg-proto-parser codegen --inFile pg_query.proto --outDir out

# New
pgsql proto-gen --inFile pg_query.proto --outDir out
```

The command options remain largely the same, with some improvements:
- `codegen` → `proto-gen`
- `protogen` → `proto-fetch`
- Boolean flags now use kebab-case (e.g., `--enumsJSON` → `--enums-json`)