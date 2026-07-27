## debugging nodes

you can put any sql here packages/transform/scripts/input.sql

then in packages/transform
pnpm test:ast

it will generate
packages/transform/scripts/output-v13.json
packages/transform/scripts/output-v14.json
packages/transform/scripts/output-v15.json
packages/transform/scripts/output-v16.json
packages/transform/scripts/output-v17.json

so you can study the resulting AST 

## Critical Parser Usage

**⚠️ MUST ONLY USE @pgsql/parser for AST parsing in the transform project**

The `@pgsql/parser` is the ONLY multi-version parser that can handle different PostgreSQL versions correctly. Using any other parser (like `/packages/parser/dist/index.js`) will result in incorrect version handling and field naming issues.

## Correct Parser Usage

### Basic Import and Usage
```javascript
import { parse, PgParser } from '@pgsql/parser';

// Parse with specific version
const result15 = await parse('SELECT 1+1 as sum', 15);
console.log(result15);
// { version: 15, result: { version: 150007, stmts: [...] } }

// Using PgParser class
const parser = new PgParser({version: 16});
const result16 = await parser.parse('SELECT * FROM users');
```

### Version-Specific Imports
```javascript
// Import specific version
import * as pg17 from '@pgsql/parser/v17';

await pg17.loadModule();
const result = await pg17.parse('SELECT 1');
console.log(result);
// { version: 170004, stmts: [...] }
```

### Error Handling
```javascript
const result = await parse('INVALID SQL');
if (result.error) {
  console.error(result.error);
  // { type: 'syntax', message: 'syntax error at or near "INVALID"', position: 0 }
}
```

## What NOT to Use

❌ **NEVER use these incorrect parser imports:**
```javascript
// WRONG - This is NOT multi-version
const parser = require('/home/ubuntu/pgsql-parser/packages/parser/dist/index.js');
const pg13Result = await parser.parse(sql, { version: 130000 });
const pg14Result = await parser.parse(sql, { version: 140000 });
```

## Field Naming Issues

When using the wrong parser:
- All versions return the same result version (170004)
- String nodes use "sval" fields instead of version-appropriate field names
- Version parameters are ignored
- Transformations fail because they're not testing actual version differences

When using the correct @pgsql/parser:
- Each version returns its proper version number
- Field names match the actual PostgreSQL version specifications
- String nodes use correct field names per version
- Transformations work because they test real version differences

## Debug Script Template

```javascript
import { parse, PgParser } from '@pgsql/parser';

async function debugTransformation() {
  const testSql = `SELECT 'test'`;
  
  // Parse with different versions
  const pg13Result = await parse(testSql, 13);
  const pg14Result = await parse(testSql, 14);
  
  console.log(`PG13 version: ${pg13Result.version}`);
  console.log(`PG14 version: ${pg14Result.version}`);
  
  // Now you'll see actual version differences
  const pg13Str = JSON.stringify(pg13Result, null, 2);
  const pg14Str = JSON.stringify(pg14Result, null, 2);
  
  // Check for field differences
  const pg13StrCount = (pg13Str.match(/"str":/g) || []).length;
  const pg13SvalCount = (pg13Str.match(/"sval":/g) || []).length;
  const pg14StrCount = (pg14Str.match(/"str":/g) || []).length;
  const pg14SvalCount = (pg14Str.match(/"sval":/g) || []).length;
  
  console.log(`PG13: "str" fields: ${pg13StrCount}, "sval" fields: ${pg13SvalCount}`);
  console.log(`PG14: "str" fields: ${pg14StrCount}, "sval" fields: ${pg14SvalCount}`);
}
```

## Transformer Testing

When testing transformers, always use the correct parser:

```javascript
import { parse } from '@pgsql/parser';
import { ASTTransformer } from '../dist/index.js';

async function testTransformer() {
  const transformer = new ASTTransformer();
  const sql = `ALTER TABLE test ADD CONSTRAINT name CHECK (col = 'value')`;
  
  // Parse with correct versions
  const pg13Result = await parse(sql, 13);
  const pg14Result = await parse(sql, 14);
  
  // Transform PG13 to PG14
  const astToTransform = JSON.parse(JSON.stringify(pg13Result.result));
  
  if (astToTransform.stmts && Array.isArray(astToTransform.stmts)) {
    astToTransform.stmts = astToTransform.stmts.map((stmtWrapper) => {
      if (stmtWrapper.stmt) {
        const transformedStmt = transformer.transform(stmtWrapper.stmt, 13, 14);
        return { ...stmtWrapper, stmt: transformedStmt };
      }
      return stmtWrapper;
    });
  }
  
  astToTransform.version = pg14Result.result.version;
  
  // Compare transformed result with actual PG14 result
  const expectedStr = JSON.stringify(pg14Result.result, null, 2);
  const transformedStr = JSON.stringify(astToTransform, null, 2);
  
  if (expectedStr === transformedStr) {
    console.log('✅ Transformation successful');
  } else {
    console.log('❌ Transformation failed');
  }
}
```

## Key Lessons Learned

1. **Parser Selection is Critical**: Using the wrong parser wastes significant compute resources and produces incorrect results
2. **Version Parameters Must Work**: If all versions return the same result, you're using the wrong parser
3. **Field Names Matter**: Different PostgreSQL versions use different field names, and transformers must handle these correctly
4. **Test Framework Alignment**: Debug scripts must use the same parser as the actual test framework
5. **ACU Conservation**: Using the correct tools from the start prevents wasted debugging cycles

## Critical: Parser Methods Are Async

**⚠️ The @pgsql/parser's `parse()` method is async and returns a Promise.**

You MUST use `await` or `.then()` when calling parser methods:

```javascript
// ❌ WRONG - returns unresolved Promise, not AST
const { Parser } = require('@pgsql/parser');
const parser = new Parser({version: 13});
const result = parser.parse(sql); // Missing await!

// ✅ CORRECT - returns actual AST structure  
const { Parser } = require('@pgsql/parser');
const parser = new Parser({version: 13});
const result = await parser.parse(sql); // With await
```

**Impact on Transformers:** If parser calls are not properly awaited, the transformer will receive empty objects `{}` instead of AST structures, causing visitor pattern methods (like `FuncCall`) to never be invoked.

**Common Symptoms:**
- Transformer methods like `FuncCall` never get called
- Empty AST objects `{}` instead of proper structures
- Visitor pattern appears broken but works with mock data
- Tests fail because transformations aren't applied

## Using Enums Package for Op Codes and Enum Handling

When working with PG13->PG14 transformations, the enums packages in `src/13/` and `src/14/` directories are essential for handling op codes and enum value differences:

### Key Enum Differences Between PG13 and PG14

- **FunctionParameterMode**: PG14 added `FUNC_PARAM_DEFAULT`
- **CoercionForm**: PG14 added `COERCE_SQL_SYNTAX` 
- **TableLikeOption**: PG14 added `CREATE_TABLE_LIKE_COMPRESSION` at position 1, shifting other values
- **RoleSpecType**: PG14 added `ROLESPEC_CURRENT_ROLE` at position 1, shifting other values

### Using Enum Utilities

```typescript
import * as PG13Enums from '../13/enums';
import * as PG14Enums from '../14/enums';

// When you see integers or strings shifting that look like op codes or enums,
// check the enum definitions to understand the mapping:
const pg13TableLikeOptions = PG13Enums.TableLikeOption;
const pg14TableLikeOptions = PG14Enums.TableLikeOption;

// Use enum-to-int.ts and enum-to-str.ts utilities for conversion if needed
```

### Common Enum-Related Test Failures

- **TableLikeOption values**: PG13 value 6 maps to PG14 value 12 due to compression option insertion
- **Function parameter modes**: `FUNC_PARAM_VARIADIC` vs `FUNC_PARAM_DEFAULT` differences
- **Function formats**: `COERCE_EXPLICIT_CALL` vs `COERCE_SQL_SYNTAX` handling

Always consult the enum files when debugging transformation issues involving numeric or string values that appear to be op codes or enum constants.

## DO NOT LOOK AT CI — only work locally with tests.

**⚠️ CRITICAL RULE: Never look at CI logs or use CI-related commands during development.**

When debugging transformation issues:
- Run tests locally using `pnpm test __tests__/kitchen-sink/13-14` or similar
- Examine local test output and failure messages
- Reproduce issues locally and verify fixes locally
- Only push changes after verifying they work locally
- Do not use `gh run view`, `git_pr_checks`, or other CI inspection commands

This ensures faster feedback loops and prevents dependency on external CI systems during development.

## DO NOT LOOK AT CI — only work locally with tests.

**⚠️ CRITICAL RULE: Never look at CI logs or use CI-related commands during development.**

When debugging transformation issues:
- Run tests locally using `pnpm test __tests__/kitchen-sink/13-14` or similar
- Examine local test output and failure messages
- Reproduce issues locally and verify fixes locally
- Only push changes after verifying they work locally
- Do not use `gh run view`, `git_pr_checks`, or other CI inspection commands

This ensures faster feedback loops and prevents dependency on external CI systems during development.

## Summary

Always use `@pgsql/parser` for multi-version PostgreSQL AST parsing in the transform package. This is the only way to get accurate version-specific results and build working transformers. Remember that all parser methods are async and must be awaited.


# Transformer Rules

## Core Principles

### 1. Explicit Field Handling (REQUIRED)
**Always explicitly handle each field** rather than using spread operators to copy everything.

#### ✅ GOOD - Explicit field handling
```ts
RoleSpec(node: PG15.RoleSpec, context: TransformerContext): { RoleSpec: PG16.RoleSpec } {
  const result: any = {};

  if (node.roletype !== undefined) {
    result.roletype = node.roletype;
  }

  if (node.rolename !== undefined) {
    result.rolename = node.rolename;
  }

  if (node.location !== undefined) {
    result.location = node.location;
  }

  return { RoleSpec: result };
}
```

#### ❌ BAD - Blind copying (only acceptable as initial placeholder)
```ts
RoleSpec(node: PG15.RoleSpec, context: TransformerContext): { RoleSpec: PG16.RoleSpec } {
  const result: any = { ...node };
  return { RoleSpec: result };
}
```


#### No-Change Transformers
For nodes that don't change between versions like this, we should probably just delete them as they should not be visited:
```ts
BooleanTest(node: PG16.BooleanTest, context: TransformerContext): any {
  return { BooleanTest: node };
}
```
