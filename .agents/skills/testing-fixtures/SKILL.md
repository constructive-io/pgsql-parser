# pgsql-parser Fixtures & Testing System

This skill documents how the fixture-based testing pipeline works in pgsql-parser and how to add new test fixtures.

## Architecture Overview

The testing pipeline has three layers:

1. **SQL fixture files** — Raw SQL statements in `__fixtures__/kitchen-sink/`
2. **Generated fixture JSON** — `__fixtures__/generated/generated.json` (individual statements keyed by path)
3. **Generated test files** — `packages/deparser/__tests__/kitchen-sink/*.test.ts`

## Directory Structure

```
__fixtures__/
  kitchen-sink/           # Source SQL fixture files
    latest/postgres/      # PostgreSQL regression test extracts
    misc/                 # Miscellaneous test cases (issues, features)
    original/             # Original upstream PostgreSQL test files
    pretty/               # Pretty-print specific test cases
  generated/
    generated.json        # Auto-generated: individual statements keyed by relative path
  plpgsql/                # PL/pgSQL fixture SQL files
  plpgsql-generated/
    generated.json        # Auto-generated: PL/pgSQL fixtures
packages/deparser/
  __tests__/
    kitchen-sink/         # Auto-generated test files from kitchen-sink fixtures
    misc/                 # Hand-written test files for specific features
    pretty/               # Pretty-print tests using PrettyTest utility
  scripts/
    make-fixtures.ts      # Splits SQL files -> generated.json
    make-kitchen-sink.ts  # Generates kitchen-sink test files
    statement-splitter.ts # Extracts individual statements from multi-statement SQL
  test-utils/
    index.ts              # Core test utilities (expectParseDeparse, FixtureTestUtils, TestUtils)
    PrettyTest.ts         # Pretty-print test helper
```

## How Fixtures Work

### Step 1: Write SQL fixture file

Create a `.sql` file in `__fixtures__/kitchen-sink/`. Organize by category:
- `misc/` for bug fixes, feature-specific tests, issue reproductions
- `pretty/` for pretty-print formatting tests
- `latest/postgres/` for PostgreSQL regression test extracts
- `original/` for original upstream PostgreSQL test files

Each SQL statement in the file becomes a separate test case. Use comments for context:

```sql
-- Brief description of what's being tested
-- Ref: constructive-io/pgsql-parser#289
SELECT EXTRACT(EPOCH FROM now());
SELECT EXTRACT(YEAR FROM TIMESTAMP '2001-02-16 20:38:40');
```

### Step 2: Regenerate fixtures

From `packages/deparser/`:

```bash
# Generate generated.json from all kitchen-sink SQL files
npm run fixtures

# Generate kitchen-sink test files from generated.json
npm run fixtures:kitchen-sink

# Or do both at once:
npm run kitchen-sink
```

**What `make-fixtures.ts` does:**
- Reads all `__fixtures__/kitchen-sink/**/*.sql` files
- Splits each file into individual statements using `statement-splitter.ts`
- Validates each statement parses correctly via `libpg-query`
- Writes all statements to `__fixtures__/generated/generated.json` as `{"relative/path-N.sql": "SQL statement"}`

**What `make-kitchen-sink.ts` does:**
- Reads all `__fixtures__/kitchen-sink/**/*.sql` files
- For each file, generates a test file in `packages/deparser/__tests__/kitchen-sink/`
- Test file name: `{category}-{name}.test.ts` (slashes become hyphens)
- Each test file uses `FixtureTestUtils.runFixtureTests()` with the list of statement keys

### Step 3: Run tests

```bash
# Run all deparser tests
cd packages/deparser && npx jest

# Run only kitchen-sink tests
npx jest __tests__/kitchen-sink/

# Run a specific fixture test
npx jest __tests__/kitchen-sink/misc-extract.test.ts
```

## Test Verification

The `FixtureTestUtils.runFixtureTests()` method (via `TestUtils.expectAstMatch()`) performs this verification for each statement:

1. **Parse** the original SQL -> AST
2. **Deparse** (non-pretty) the AST -> SQL string
3. **Reparse** the deparsed SQL -> new AST
4. **Compare** the cleaned ASTs — they must match
5. **Repeat** steps 2-4 with `pretty: true`

This ensures full round-trip fidelity: `parse(sql) -> deparse(ast) -> parse(deparsed) === original AST`

The `expectParseDeparse()` utility in `test-utils/index.ts` does the same thing for hand-written tests.

## Pretty-Print Tests

Pretty-print tests use a different pattern via `PrettyTest` class in `test-utils/PrettyTest.ts`:

```typescript
import { PrettyTest } from '../../test-utils/PrettyTest';

const testCases = [
  'pretty/misc-1.sql',
  'pretty/misc-2.sql',
];

const prettyTest = new PrettyTest(testCases);
prettyTest.generateTests();
```

This generates two tests per case (pretty and non-pretty) and uses Jest snapshots. Pretty tests read from `generated.json` and compare output via `toMatchSnapshot()`.

## Adding a New Fixture (Quick Reference)

1. Create/edit a `.sql` file in `__fixtures__/kitchen-sink/{category}/`
2. Run `cd packages/deparser && npm run kitchen-sink`
3. Run `npx jest` to verify all tests pass
4. Commit the `.sql` file, `generated.json`, and any new generated test files in `__tests__/kitchen-sink/`

## Package Scripts Reference

From `packages/deparser/package.json`:

| Script | Command | Description |
|--------|---------|-------------|
| `fixtures` | `ts-node scripts/make-fixtures.ts` | Regenerate `generated.json` |
| `fixtures:kitchen-sink` | `ts-node scripts/make-kitchen-sink.ts` | Regenerate kitchen-sink test files |
| `kitchen-sink` | `npm run fixtures && npm run fixtures:kitchen-sink` | Both steps combined |
| `fixtures:ast` | `ts-node scripts/make-fixtures-ast.ts` | Generate AST JSON fixtures (from legacy) |
| `fixtures:sql` | `ts-node scripts/make-fixtures-sql.ts` | Generate SQL fixtures via native deparse (from legacy) |
| `fixtures:upstream-diff` | `ts-node scripts/make-upstream-diff.ts` | Generate diff of upstream vs deparsed |
| `test` | `jest` | Run all tests |
| `test:watch` | `jest --watch` | Run tests in watch mode |

## Build & Lint

```bash
# From repo root
pnpm install
pnpm run build

# From packages/deparser
npm run build      # tsc (CJS + ESM) + asset copy
npm run lint       # eslint --fix
```
