# PL/pgSQL Deparser - Agent Instructions

## Adding Test Fixtures

When adding new test fixtures for the PL/pgSQL deparser, follow this workflow:

### Step 1: Add SQL Fixtures

Add your PL/pgSQL function/procedure definitions to the appropriate fixture file in `__fixtures__/plpgsql/`. For deparser-specific fixes, use `plpgsql_deparser_fixes.sql`.

Example fixture:
```sql
-- Test N: Description of what this tests
CREATE FUNCTION test_example(p_input text, OUT result text)
LANGUAGE plpgsql AS $$
BEGIN
  result := p_input;
  RETURN;
END$$;
```

### Step 2: Generate Test Fixtures

Run the fixture generation script from the plpgsql-deparser package:

```bash
cd packages/plpgsql-deparser
pnpm fixtures
```

This script (`scripts/make-fixtures.ts`):
1. Reads all `.sql` files from `__fixtures__/plpgsql/`
2. Parses each file to extract PL/pgSQL statements (CREATE FUNCTION, CREATE PROCEDURE, DO blocks)
3. Validates each statement can be parsed by the PL/pgSQL parser
4. Outputs valid fixtures to `__fixtures__/plpgsql-generated/generated.json`

### Step 3: Run Tests

Run the test suite to verify your fixtures round-trip correctly:

```bash
cd packages/plpgsql-deparser
pnpm test
```

The round-trip test (`__tests__/plpgsql-deparser.test.ts`):
1. Loads all fixtures from `generated.json`
2. For each fixture: parse -> deparse -> reparse
3. Compares the AST from original parse with the AST from reparsed output
4. Reports any failures (AST mismatches or reparse failures)

### Step 4: Add Snapshot Tests (Optional but Recommended)

For important deparser fixes, add explicit test cases with snapshots to `__tests__/deparser-fixes.test.ts`:

```typescript
it('should handle [description]', async () => {
  const sql = `CREATE FUNCTION test_example(...)
LANGUAGE plpgsql AS $$
BEGIN
  -- your test case
END$$`;

  await testUtils.expectAstMatch('description', sql);

  const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
  const deparsed = deparseSync(parsed);
  expect(deparsed).toMatchSnapshot();
  // Add specific assertions
  expect(deparsed).toContain('expected output');
});
```

Then run tests with snapshot update:

```bash
pnpm test --updateSnapshot
```

### Step 5: Commit All Files

Always commit the fixture file, generated.json, test file, AND snapshots together:

```bash
git add __fixtures__/plpgsql/plpgsql_deparser_fixes.sql
git add __fixtures__/plpgsql-generated/generated.json
git add packages/plpgsql-deparser/__tests__/deparser-fixes.test.ts
git add packages/plpgsql-deparser/__tests__/__snapshots__/deparser-fixes.test.ts.snap
git commit -m "test: add fixtures for [description]"
```

## Important Notes

- The `generated.json` file is the source of truth for tests - it must be regenerated when fixtures change
- Fixtures that fail PL/pgSQL parsing are skipped (logged as warnings during generation)
- The test suite has a `KNOWN_FAILING_FIXTURES` set for fixtures with known issues - avoid adding to this unless necessary
- When adding fixtures for new deparser features, ensure the fixture exercises the specific AST pattern you're testing

## Fixture File Conventions

- `plpgsql_deparser_fixes.sql` - Fixtures for deparser bug fixes and edge cases
- `plpgsql_*.sql` - PostgreSQL regression test fixtures (from upstream)
- Each fixture should have a comment describing what it tests
- Number fixtures sequentially (Test 1, Test 2, etc.) within each file
