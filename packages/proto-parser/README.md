# pg-proto-parser

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/pgsql-parser/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/pgsql-parser/blob/main/LICENSE"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

`pg-proto-parser` is a TypeScript project that parses [pganalyze/libpg_query](https://github.com/pganalyze/libpg_query) PostgreSQL Protocol Buffers (protobuf) definitions and generates TypeScript interfaces, utility functions, and JSON mappings for the enums defined in the protobuf schema. Designed to work with [launchql/pgsql-parser](https://github.com/constructive-io/pgsql-parser) for maintainable upgrades.

## Features

- Parses protobuf definitions and creates a structured representation in TypeScript.
- Generates TypeScript interfaces for protobuf messages.
- Creates utility functions for enum value conversions with multiple output formats:
  - Bidirectional conversion functions (string ↔ number)
  - Unidirectional conversion functions with precise types
  - Switch statement or nested object output formats
- Produces JSON or TypeScript files mapping enum names to integer values and vice versa
- Supports tree-shakable enum utilities for optimal bundle sizes

## Parsing and Generating Files

Here's how to parse protobuf files and generate the output:

```js
import { PgProtoParser } from 'pg-proto-parser';

// Create PgProtoParser
const parser = new PgProtoParser(inFile, { outDir });

// Generate TypeScript and JSON files
await parser.write();
```

`pg-proto-parser` will generate the following files in the specified `outDir`:

- [`types.ts`](https://raw.githubusercontent.com/launchql/pgsql-parser/main/__fixtures__/output/types/optionalFields/types.ts): TypeScript file containing interfaces for protobuf messages.
- [`enums.ts`](https://raw.githubusercontent.com/launchql/pgsql-parser/main/__fixtures__/output/enums/pure/removeUndef/enums.ts): TypeScript file containing enums for protobuf messages.
- [`asts.ts`](https://raw.githubusercontent.com/launchql/pgsql-parser/main/__fixtures__/output/utils/astHelpers/inlineNestedObj/asts.ts): TypeScript file containing helpers to create PostgreSQL ASTs.
- [`utils.ts`](https://raw.githubusercontent.com/launchql/pgsql-parser/main/__fixtures__/output/utils/astHelpers/inlineNestedObj/utils.ts): TypeScript file containing utility functions for enums.
- [`enums2int.json`](https://raw.githubusercontent.com/launchql/pgsql-parser/main/__fixtures__/output/enums/json/enabled/enums2int.json): JSON mapping of enum names to integer values.
- [`enums2str.json`](https://raw.githubusercontent.com/launchql/pgsql-parser/main/__fixtures__/output/enums/json/enabled/enums2str.json): JSON mapping of integer values to enum names.

### Example: Generating TypeScript Enum Maps

You can generate TypeScript exports instead of JSON files for enum mappings:

```js
const parser = new PgProtoParser(inFile, {
  outDir,
  enums: {
    enumMap: {
      enabled: true,
      format: 'ts',  // Generate TypeScript exports
      toIntOutFile: 'enum-to-int.ts',
      toStrOutFile: 'enum-to-str.ts'
    }
  }
});

await parser.write();
```

This will generate TypeScript files with exports like:

```ts
// enum-to-int.ts
export const enumToIntMap = {
  OverridingKind: {
    OVERRIDING_NOT_SET: 0,
    OVERRIDING_USER_VALUE: 1,
    OVERRIDING_SYSTEM_VALUE: 2
  },
  // ... more enums
};
export type EnumToIntMap = typeof enumToIntMap;

// enum-to-str.ts
export const enumToStrMap = {
  OverridingKind: {
    "0": 'OVERRIDING_NOT_SET',
    "1": 'OVERRIDING_USER_VALUE',
    "2": 'OVERRIDING_SYSTEM_VALUE'
  },
  // ... more enums
};
export type EnumToStrMap = typeof enumToStrMap;
```

### Example: Generating Enum Utility Functions

You can generate utility functions for runtime enum conversions:

```js
// Bidirectional function (default)
const parser = new PgProtoParser(inFile, {
  outDir,
  utils: {
    enums: {
      enabled: true,
      filename: 'enum-utils.ts'
    }
  }
});

// Unidirectional functions with switch statements
const parser = new PgProtoParser(inFile, {
  outDir,
  utils: {
    enums: {
      enabled: true,
      unidirectional: true,
      toIntFilename: 'enum-to-int.ts',
      toStringFilename: 'enum-to-string.ts'
    }
  }
});

// Unidirectional functions with nested objects format
const parser = new PgProtoParser(inFile, {
  outDir,
  utils: {
    enums: {
      enabled: true,
      unidirectional: true,
      outputFormat: 'nestedObjects',
      toIntFilename: 'enum-to-int-map.ts',
      toStringFilename: 'enum-to-string-map.ts'
    }
  }
});
```

#### Generated Utility Functions

**Bidirectional (default):**
```ts
// utils.ts
export const getEnumValue = (enumType: EnumType, key: string | number) => {
  // Returns number for string input, string for number input
};
```

**Unidirectional with switch statements:**
```ts
// enum-to-int.ts
export const getEnumInt = (enumType: EnumType, key: string): number => {
  // Converts enum string to number
};

// enum-to-string.ts
export const getEnumString = (enumType: EnumType, key: number): string => {
  // Converts enum number to string
};
```

**Unidirectional with nested objects:**
```ts
// enum-to-int-map.ts
export const enumToIntMap = {
  OverridingKind: (key: string): number => { /* ... */ },
  QuerySource: (key: string): number => { /* ... */ },
  // ... more enums
};

// Usage
const value = enumToIntMap.OverridingKind("OVERRIDING_USER_VALUE"); // Returns: 1
```

## Configuration

You can configure `pg-proto-parser` by passing different parameters to the `ProtoStore` constructor:

- `root`: The protobuf `Root` object containing your schema.
- `options`: Options defined as `PgProtoParserOptions` (see below)

## Options

The options for `PgProtoParserOptions` are organized into the following categories:

### General Options

| Option          | Description                                                    | Default Value            |
|-----------------|----------------------------------------------------------------|--------------------------|
| `outDir`        | The directory where the generated files will be saved.         | `process.cwd() + "/out"` |
| `exclude`       | List of type or enum names to exclude during processing.       | `[]`                     |

### Type Generation Options

| Option                      | Description                                                                                                                     | Default Value   |
|-----------------------------|---------------------------------------------------------------------------------------------------------------------------------|-----------------|
| `types.enabled`             | Whether to generate TypeScript interfaces for protobuf messages.                                                                | `false`         |
| `types.filename`            | Filename for the generated TypeScript interfaces.                                                                               | `'types.ts'`    |
| `types.optionalFields`      | Generates TypeScript interfaces with optional fields mapping to the PostgreSQL node types' fields; sets all fields to optional. | `true`          |
| `types.enumsSource`         | Path to the TypeScript enums to use when generating TypeScript interfaces.                                                      | `'./enums'`     |
| `types.wrappedNodeTypeExport` | Simpler option for exporting Node type references.                                                                           | `true`          |



### Enum Generation Options

| Option                      | Description                                                                                         | Default Value      |
|-----------------------------|-----------------------------------------------------------------------------------------------------|--------------------|
| `enums.enabled`             | Outputs TypeScript enum types for the PostgreSQL enums.                                            | `false`            |
| `enums.filename`            | Filename for the generated TypeScript enums.                                                       | `'enums.ts'`       |
| `enums.enumsAsTypeUnion`    | Uses strings to define enum types as specified for the fields of each proto message type.          | `true`             |
| `enums.removeUndefinedAt0`  | Removes the initial `UNDEFINED` enum entry and adjusts the subsequent values by decrementing them. | `true`             |

### Enum Mapping Options

| Option                      | Description                                                                                         | Default Value      |
|-----------------------------|-----------------------------------------------------------------------------------------------------|--------------------|
| `enums.enumMap.enabled`     | Whether to generate enum mapping files (replaces the old `enums.json` options).                    | `false`            |
| `enums.enumMap.format`      | Output format for enum mappings: 'json' for plain JSON files, 'ts' for TypeScript exports.        | `'json'`           |
| `enums.enumMap.toIntOutFile`| Output file name for the mapping of enum names to integer values.                                  | `'enums2int.json'` |
| `enums.enumMap.toStrOutFile`| Output file name for the mapping of integer values to enum names.                                  | `'enums2str.json'` |

**Note:** The `enums.json.*` options are deprecated in favor of `enums.enumMap.*`. When using TypeScript format (`format: 'ts'`), the file extensions will be automatically corrected to `.ts`.

### Utility Generation Options

| Option                                 | Description                                                                     | Default Value      |
|----------------------------------------|---------------------------------------------------------------------------------|--------------------|
| `utils.enums.enabled`                  | Whether to generate TypeScript utility functions for enums.                    | `false`            |
| `utils.enums.filename`                 | Filename for the generated enums utilities (bidirectional).                    | `'utils.ts'`       |
| `utils.enums.unidirectional`           | Generate separate unidirectional conversion functions instead of bidirectional. | `false`            |
| `utils.enums.toIntFilename`            | Filename for string-to-int conversion utilities (when unidirectional).         | `'enum-to-int.ts'` |
| `utils.enums.toStringFilename`         | Filename for int-to-string conversion utilities (when unidirectional).         | `'enum-to-string.ts'` |
| `utils.enums.outputFormat`             | Output format: 'switchStatements' or 'nestedObjects'.                         | `'switchStatements'` |
| `utils.astHelpers.enabled`             | Outputs TypeScript helpers for building PostgreSQL ASTs.                        | `false`            |
| `utils.astHelpers.wrappedTypesSource`  | Path to the TypeScript types to use when generating AST helpers.               | `'./wrapped'`      |
| `utils.astHelpers.inlineNestedObj`     | Whether to inline `nested-obj` code within the generated file.                 | `false`            |
| `utils.astHelpers.nestedObjFile`       | Filename for the inlined `nested-obj` code, if `inlineNestedObj` is true.     | `'nested-obj.ts'`  |
| `utils.astHelpers.filename`            | Filename for the generated AST helpers.                                        | `'asts.ts'`        |

### Runtime Schema Options

| Option                   | Description                                                                              | Default Value       |
|--------------------------|------------------------------------------------------------------------------------------|---------------------|
| `runtimeSchema.enabled`  | Whether to generate runtime schema for AST nodes with metadata about node types and field specifications. | `false` |
| `runtimeSchema.filename` | Filename for the generated runtime schema file.                                         | `'runtime-schema'`  |
| `runtimeSchema.format`   | Output format for runtime schema generation ('json' or 'typescript').                    | `'json'`            |

Each of these options can be set when initializing the `PgProtoParser` to customize its behavior and output.

## Meta AST (`generateTsAstCodeFromPgAst`)

`generateTsAstCodeFromPgAst` is a method that transforms a PostgreSQL Abstract Syntax Tree (AST) into TypeScript code capable of generating an equivalent AST. This function facilitates the dynamic creation of ASTs, allowing for programmable query construction and manipulation in TypeScript.

It generates code with syntax for [@pgsql/utils](https://github.com/constructive-io/pgsql-parser/tree/main/packages/utils), using runtime schema information to determine whether nodes should be wrapped (`t.nodes.*`) or unwrapped (`t.ast.*`).

```ts
import { generateTsAstCodeFromPgAst } from 'pg-proto-parser';
import { runtimeSchema } from './path/to/your/generated/runtime-schema';
import { parse } from 'pgsql-parser';

// Example SQL query
const sql = 'SELECT * FROM my_table WHERE id = 1';

// Parse the SQL query to get the PostgreSQL AST
const pgAst = parse(sql);

// Generate TypeScript AST builder code from the PostgreSQL AST using runtime schema
const tsAstBuilderCode = generateTsAstCodeFromPgAst(
  pgAst[0].RawStmt.stmt,
  runtimeSchema
);

console.log(tsAstBuilderCode);
// OUTPUT BELOW:
// make sure to use this import when using
// import ast from '@pgsql/utils';

t.nodes.selectStmt({
  targetList: [t.nodes.resTarget({
    val: t.nodes.columnRef({
      fields: [t.nodes.aStar({})],
      location: 7
    }),
    location: 7
  })],
  fromClause: [t.nodes.rangeVar({
    relname: "my_table",
    inh: true,
    relpersistence: "p",
    location: 14
  })],
  whereClause: t.nodes.aExpr({
    kind: "AEXPR_OP",
    name: [t.nodes.string({
      sval: "="
    })],
    lexpr: t.nodes.columnRef({
      fields: [t.nodes.string({
        sval: "id"
      })],
      location: 29
    }),
    rexpr: t.nodes.aConst({
      ival: t.ast.integer({
        ival: 1
      }),
      location: 34
    }),
    location: 32
  }),
  limitOption: "LIMIT_OPTION_DEFAULT",
  op: "SETOP_NONE"
})
```