# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [17.17.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.16.0...pgsql-deparser@17.17.0) (2026-01-01)

### Bug Fixes

- remove pg_catalog prefix for unknown types in deparser ([0b45483](https://github.com/constructive-io/pgsql-parser/commit/0b4548375d9d9a9803f48e3ccc2cc466e18ac57c)), closes [constructive-io/constructive-planning#477](https://github.com/constructive-io/constructive-planning/issues/477)

### Features

- **pgsql-deparser:** add pretty-printing for INSERT VALUES and ON CONFLICT SET ([6428b87](https://github.com/constructive-io/pgsql-parser/commit/6428b87b98bdfcc7fd1b37ff8fd254f59a6d3303))

# [17.16.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.15.2...pgsql-deparser@17.16.0) (2025-12-31)

### Features

- **deparser:** add pretty printing for CREATE FUNCTION params and RETURNS TABLE ([9dda8d1](https://github.com/constructive-io/pgsql-parser/commit/9dda8d1bf8c9d18a82ad3e462d93edb93e8662eb))

## [17.15.2](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.15.1...pgsql-deparser@17.15.2) (2025-12-27)

**Note:** Version bump only for package pgsql-deparser

## [17.15.1](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.15.0...pgsql-deparser@17.15.1) (2025-12-27)

**Note:** Version bump only for package pgsql-deparser

# [17.15.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.14.0...pgsql-deparser@17.15.0) (2025-12-25)

### Features

- **deparser:** add type-name quoting policy for minimal quoting in type positions ([9104bf3](https://github.com/constructive-io/pgsql-parser/commit/9104bf379a2874a110c5286a3b0bad8caab19804))

# [17.14.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.13.0...pgsql-deparser@17.14.0) (2025-12-25)

### Features

- add pretty fixtures for quoting and formatting behaviors ([aba85ef](https://github.com/constructive-io/pgsql-parser/commit/aba85ef124d6a097a2df6f9168225b86bf78059d))
- add relaxed quoting for qualified name tails ([ef51c09](https://github.com/constructive-io/pgsql-parser/commit/ef51c093cbc273e3644b70a1cef52b2c09078924))
- implement quoteDottedName for relaxed quoting after dots ([4c81523](https://github.com/constructive-io/pgsql-parser/commit/4c81523cf1a777ef9b694288192b482c8c3102b4))

# [17.13.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.12.2...pgsql-deparser@17.13.0) (2025-12-24)

### Bug Fixes

- don't quote type names - they are not identifiers ([b85dacf](https://github.com/constructive-io/pgsql-parser/commit/b85dacfa8f91be2e1d44c62328f45afa185d6760))
- update keywords.ts generator to include Set<string> type annotations ([fb6d159](https://github.com/constructive-io/pgsql-parser/commit/fb6d159f0b2a4c34e045eecec7c0069d3bf43f5d))

### Features

- add quoteIdentifier and quoteQualifiedIdentifier from PostgreSQL ruleutils.c ([b30c359](https://github.com/constructive-io/pgsql-parser/commit/b30c3599c1a1f73e54b44b517ea31bc87cf23257)), closes [/github.com/postgres/postgres/blob/fab5cd3dd1323f9e66efeb676c4bb212ff340204/src/backend/utils/adt/ruleutils.c#L13055-L13137](https://github.com//github.com/postgres/postgres/blob/fab5cd3dd1323f9e66efeb676c4bb212ff340204/src/backend/utils/adt/ruleutils.c/issues/L13055-L13137) [/github.com/postgres/postgres/blob/fab5cd3dd1323f9e66efeb676c4bb212ff340204/src/backend/utils/adt/ruleutils.c#L13139-L13156](https://github.com//github.com/postgres/postgres/blob/fab5cd3dd1323f9e66efeb676c4bb212ff340204/src/backend/utils/adt/ruleutils.c/issues/L13139-L13156)

## [17.12.2](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.12.1...pgsql-deparser@17.12.2) (2025-12-11)

**Note:** Version bump only for package pgsql-deparser

## [17.12.1](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.12.0...pgsql-deparser@17.12.1) (2025-11-23)

**Note:** Version bump only for package pgsql-deparser

# [17.12.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.11.1...pgsql-deparser@17.12.0) (2025-11-23)

**Note:** Version bump only for package pgsql-deparser

## [17.11.1](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.10.0...pgsql-deparser@17.11.1) (2025-08-08)

**Note:** Version bump only for package pgsql-deparser

# [17.10.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.9.1...pgsql-deparser@17.10.0) (2025-07-23)

### Features

- make pretty print the default option ([71eba83](https://github.com/constructive-io/pgsql-parser/commit/71eba8350a0d057e867d6dc9ed8b4013ebb99370))

## [17.9.1](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.9.0...pgsql-deparser@17.9.1) (2025-07-17)

**Note:** Version bump only for package pgsql-deparser

# [17.9.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.8.5...pgsql-deparser@17.9.0) (2025-07-01)

### Bug Fixes

- add COLLATE clause support to ALTER TABLE ADD COLUMN ([b778ed0](https://github.com/constructive-io/pgsql-parser/commit/b778ed0f640cbe6c3f818cfdf8314ca468a9f7ac))
- correct ALTER TABLE ADD IDENTITY column generation ([590e82f](https://github.com/constructive-io/pgsql-parser/commit/590e82f31907eff1305e91ec46b1dd34899a2a1d))

### Features

- add multi-line pretty formatting for ALTER TABLE statements ([cb2ba9f](https://github.com/constructive-io/pgsql-parser/commit/cb2ba9f79f5a838aefac40c7e8ef1ae38b1c6d09))
- implement pretty printing for ALTER TABLE ADD COLUMN statements ([65a0002](https://github.com/constructive-io/pgsql-parser/commit/65a00026382e0b0721d3558898dab7e9518f65b3))

## [17.8.5](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.8.4...pgsql-deparser@17.8.5) (2025-07-01)

**Note:** Version bump only for package pgsql-deparser

## [17.8.4](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.8.3...pgsql-deparser@17.8.4) (2025-07-01)

**Note:** Version bump only for package pgsql-deparser

## [17.8.3](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.8.2...pgsql-deparser@17.8.3) (2025-06-27)

### Bug Fixes

- improve CREATE TABLE constraint indentation using proper context indentLevel ([22d5915](https://github.com/constructive-io/pgsql-parser/commit/22d5915933313a2f5dfca998dbde7a2cb59e2a2e))
- update formatWindowFrame and deparseOperatorName to accept context parameters ([18236c0](https://github.com/constructive-io/pgsql-parser/commit/18236c0c071080084862997eb1d66bda67d40c66))
- update RenameStmt to pass objtype when spawning AlterTypeStmt context ([14326c3](https://github.com/constructive-io/pgsql-parser/commit/14326c3c79587fdab1be6103fe8c054a15ca315f))

### Features

- improve indentation for boolean expressions and SELECT clauses ([6cc2f4e](https://github.com/constructive-io/pgsql-parser/commit/6cc2f4e4566541c671d5ffc42625d4c47ea76aa5))
- make SqlFormatter private and add context-aware indentation ([2a76b3d](https://github.com/constructive-io/pgsql-parser/commit/2a76b3d3f7e63837d9a3d3bc5a04d16a519b9278))

## [17.8.2](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.8.1...pgsql-deparser@17.8.2) (2025-06-26)

### Reverts

- Revert "Fix CHECK constraint closing parenthesis alignment" ([e247c55](https://github.com/constructive-io/pgsql-parser/commit/e247c5563f7bd7ad9e8d8b864c7e2a9356d487ec))

## [17.8.1](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.8.0...pgsql-deparser@17.8.1) (2025-06-23)

**Note:** Version bump only for package pgsql-deparser

# [17.8.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.7.2...pgsql-deparser@17.8.0) (2025-06-23)

**Note:** Version bump only for package pgsql-deparser

## [17.7.2](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.7.1...pgsql-deparser@17.7.2) (2025-06-23)

**Note:** Version bump only for package pgsql-deparser

## [17.7.1](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.7.0...pgsql-deparser@17.7.1) (2025-06-23)

**Note:** Version bump only for package pgsql-deparser

# [17.7.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.6.2...pgsql-deparser@17.7.0) (2025-06-23)

**Note:** Version bump only for package pgsql-deparser

## [17.6.2](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.6.1...pgsql-deparser@17.6.2) (2025-06-22)

**Note:** Version bump only for package pgsql-deparser

## [17.6.1](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.6.0...pgsql-deparser@17.6.1) (2025-06-22)

**Note:** Version bump only for package pgsql-deparser

# [17.6.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.5.0...pgsql-deparser@17.6.0) (2025-06-22)

**Note:** Version bump only for package pgsql-deparser

# [17.5.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.4.2...pgsql-deparser@17.5.0) (2025-06-22)

**Note:** Version bump only for package pgsql-deparser

## [17.4.2](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.4.1...pgsql-deparser@17.4.2) (2025-06-22)

### Bug Fixes

- add test back ([d44ab3f](https://github.com/constructive-io/pgsql-parser/commit/d44ab3f126a7661efee3ebc50d1fdb1931dc5024))
- async forEach bug in test framework preventing error catching ([01b01d8](https://github.com/constructive-io/pgsql-parser/commit/01b01d80d406c23bb692954a393d8e9afe122a54))
- quotes ([fac64e9](https://github.com/constructive-io/pgsql-parser/commit/fac64e9360dba171a17585c82cc43daa1b91106f))

### Features

- implement automatic E-prefix detection for escaped string literals ([e029f29](https://github.com/constructive-io/pgsql-parser/commit/e029f297589925102834a794a29f14c00a9c3e2b))

## [17.4.1](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.4.0...pgsql-deparser@17.4.1) (2025-06-21)

**Note:** Version bump only for package pgsql-deparser

# [17.4.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.1.0...pgsql-deparser@17.4.0) (2025-06-21)

### Code Refactoring

- **deparser:** improve entry point handling with proper type guards ([a240d13](https://github.com/constructive-io/pgsql-parser/commit/a240d1313b9a57035656d7b00c7f664d90946248))

### Features

- **deparser:** add ParseResult support, array handling, and configurable function delimiters ([1815fff](https://github.com/constructive-io/pgsql-parser/commit/1815fff259940adcb1d619b6e8479cf59b11115f))

### BREAKING CHANGES

- **deparser:** Removed unused stmt() and version() methods. Use deparse() with appropriate node types instead.

The deparser now properly handles:

1. ParseResult from libpg-query (bare or wrapped)
2. Wrapped RawStmt nodes
3. Arrays of Nodes
4. Single Node statements

Note: ParseResult.stmts contains RawStmt objects directly (not wrapped as nodes)

# [17.2.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@17.1.0...pgsql-deparser@17.2.0) (2025-06-21)

### Code Refactoring

- **deparser:** improve entry point handling with proper type guards ([a240d13](https://github.com/constructive-io/pgsql-parser/commit/a240d1313b9a57035656d7b00c7f664d90946248))

### Features

- **deparser:** add ParseResult support, array handling, and configurable function delimiters ([1815fff](https://github.com/constructive-io/pgsql-parser/commit/1815fff259940adcb1d619b6e8479cf59b11115f))

### BREAKING CHANGES

- **deparser:** Removed unused stmt() and version() methods. Use deparse() with appropriate node types instead.

The deparser now properly handles:

1. ParseResult from libpg-query (bare or wrapped)
2. Wrapped RawStmt nodes
3. Arrays of Nodes
4. Single Node statements

Note: ParseResult.stmts contains RawStmt objects directly (not wrapped as nodes)

# [17.1.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-deparser@13.15.0...pgsql-deparser@17.1.0) (2025-06-21)

### Bug Fixes

- achieve 97.4% pass rate by resolving CreateFunctionStmt DefElem List handling ([23725bb](https://github.com/constructive-io/pgsql-parser/commit/23725bba8d379aab299e687a49d4b414e74f906d))
- add A_Expr_Kind and DropBehavior type annotations to resolve remaining TypeScript compilation errors ([5a0e97e](https://github.com/constructive-io/pgsql-parser/commit/5a0e97e4776e35e26c45dedf8cf9e0416e4097bc))
- add accessMethod support to CreateStmt for USING clauses in CREATE TABLE statements ([712069b](https://github.com/constructive-io/pgsql-parser/commit/712069bf553687387093bae9f5a39587baa1cf77))
- add ALTER CONVERSION schema handling ([378e8a7](https://github.com/constructive-io/pgsql-parser/commit/378e8a75a916214e2e732c5e63d7facbbf0610a5))
- add ALTER OPERATOR FAMILY schema handling ([80c118f](https://github.com/constructive-io/pgsql-parser/commit/80c118f67c5c5d40ddb6f1e36711fae5b4f6b02e))
- add ALTER OPERATOR schema handling ([7127f83](https://github.com/constructive-io/pgsql-parser/commit/7127f83788af2af77d7cfb59700da386a267c16c))
- add ALTER TEXT SEARCH CONFIGURATION schema handling ([c9ce6f9](https://github.com/constructive-io/pgsql-parser/commit/c9ce6f9b1426decd67407107cfc4c097bb081681))
- add ALTER TEXT SEARCH DICTIONARY schema handling ([62934bf](https://github.com/constructive-io/pgsql-parser/commit/62934bf38f791e1e9e4dede522967a8afe3ac4ca))
- add ALTER TEXT SEARCH PARSER schema handling ([4638cbd](https://github.com/constructive-io/pgsql-parser/commit/4638cbd75a0e224258af1818dd66be249c4bbc57))
- add ALTER TEXT SEARCH TEMPLATE schema handling ([838e145](https://github.com/constructive-io/pgsql-parser/commit/838e1450074054e18cb44cc02c34ce162c099679))
- add ALTER TYPE schema handling ([8b9322b](https://github.com/constructive-io/pgsql-parser/commit/8b9322be107a744a33542cd75ab57c1debb636c6))
- add AlterDomainStmt subtypes O, N, T for SET/DROP NOT NULL and SET/DROP DEFAULT operations ([c7b6a87](https://github.com/constructive-io/pgsql-parser/commit/c7b6a87b5881843decb08e7079792a0cdbf4bdf2))
- add AlterFunctionStmt support to DefElem for proper function option handling ([63fb427](https://github.com/constructive-io/pgsql-parser/commit/63fb427cf5fe93f5e403b2d8817f5e89c1bbd959))
- add AS keyword to Alias method for proper table alias formatting - resolves INSERT AS alias issues ([c0e4463](https://github.com/constructive-io/pgsql-parser/commit/c0e4463c4fa79395358a89a0bdd2db77c5681a77))
- add AT TIME ZONE infix syntax preservation for pg_catalog.timezone function calls ([ed94b0c](https://github.com/constructive-io/pgsql-parser/commit/ed94b0c1100e1876f50e38a552d17bb9207c4be6))
- add bpchar support to TypeCast :: syntax - improves char type handling ([35e6882](https://github.com/constructive-io/pgsql-parser/commit/35e688296a091d317ba133be5f11c1140195d046))
- add CASCADE boolean flag handling and prevent alias double-quoting ([9431f36](https://github.com/constructive-io/pgsql-parser/commit/9431f36a648db02fd4c90cf72dc76edbcb7471b2))
- add CASCADE/RESTRICT behavior handling to AT_AddColumn ([8624053](https://github.com/constructive-io/pgsql-parser/commit/8624053e0f6cf032f170f30f25d55f3422381dd9))
- add CASCADE/RESTRICT behavior handling to AT_AlterColumnType ([6aae957](https://github.com/constructive-io/pgsql-parser/commit/6aae9579331bb704d77e521ea41c7e112fa9c518))
- add CASCADE/RESTRICT behavior handling to RenameStmt ([debca4c](https://github.com/constructive-io/pgsql-parser/commit/debca4c6bfc98dc8e89a207c37caf535ece2e3a2))
- add COERCE_SQL_SYNTAX support for is_normalized, normalize, and system_user functions ([55cab49](https://github.com/constructive-io/pgsql-parser/commit/55cab4957c15cf4033a4e83d300158ff73c2437f))
- add COLLATE clause support to ColumnDef and fix CollateClause quoting ([d9351ff](https://github.com/constructive-io/pgsql-parser/commit/d9351ff0e66c03722269dae0c46392ac6901aa6b))
- add CollateClause parentheses and DefineStmt OBJECT_COLLATION support - maintained 69 failed test suites with no regressions ([601197b](https://github.com/constructive-io/pgsql-parser/commit/601197b2d78fe2e057b1e568c6a377bfd38d4f7d))
- add column number support in AT_SetStatistics case ([1401e66](https://github.com/constructive-io/pgsql-parser/commit/1401e6622a76ff052c60b93431c9f31b6b912ff3))
- add COMMENT ON TRIGGER syntax support ([8f6326e](https://github.com/constructive-io/pgsql-parser/commit/8f6326ee2d1fc4774d099c6e97abe6a59ca710d6))
- add comprehensive ALTER OWNER support for text search objects and operator family/class items ([fa39543](https://github.com/constructive-io/pgsql-parser/commit/fa3954341442cc1a59e5c72bd179de1cf02292b5))
- add comprehensive type alias mappings for PostgreSQL internal types ([ce5df2f](https://github.com/constructive-io/pgsql-parser/commit/ce5df2f08d7556d7ba2bebd5a92a1335147af466))
- add CONSTR_EXCLUSION support for EXCLUDE USING constraints ([3802040](https://github.com/constructive-io/pgsql-parser/commit/38020401cfff66bbca34cecdb3f7b27e7da7f5e5))
- add CREATE AGGREGATE ORDER BY pattern handling ([a9ddd22](https://github.com/constructive-io/pgsql-parser/commit/a9ddd229fce1f822f58defb230f1249053794ee4))
- add CREATE OPERATOR parameter quoting and CREATE INDEX opclassopts support ([11b5fdc](https://github.com/constructive-io/pgsql-parser/commit/11b5fdc782d68202ec29d9fdd7fe34d6f8c3908e))
- add CTE materialization clause support in CommonTableExpr method ([62993aa](https://github.com/constructive-io/pgsql-parser/commit/62993aaf61524f5e1d46e7ca6b73a3f4d8a63ffd))
- add DATABASE object type support to GrantStmt method - resolves missing DATABASE keyword in grant statements ([c778b99](https://github.com/constructive-io/pgsql-parser/commit/c778b99ab9317350fa8380eaf9139473c808e77c))
- add DefElem connectionlimit support for CREATE ROLE statements ([af6259f](https://github.com/constructive-io/pgsql-parser/commit/af6259f7e7a615165eebd4f9a47cf7b00ff92c85))
- add direct ObjectWithArgs handling for COMMENT ON OPERATOR statements ([42102ca](https://github.com/constructive-io/pgsql-parser/commit/42102ca4b0eb9c3810637f2c91bd5c6363ff51d1))
- add empty parentheses support for CompositeTypeStmt ([697b27c](https://github.com/constructive-io/pgsql-parser/commit/697b27c013ce5ff04150c826bf42d7a5fa391f9e))
- add IF EXISTS clause support to AlterObjectSchemaStmt ([f6cd8fb](https://github.com/constructive-io/pgsql-parser/commit/f6cd8fb37a864745fb7dffd0b2ba6b97455eaa41))
- add IF EXISTS support to ALTER TABLE DROP operations ([6da4895](https://github.com/constructive-io/pgsql-parser/commit/6da4895702ca008a09a9fc406d077871bb3fcf4d))
- add INCLUDING ALL special case handling for TableLikeClause ([0961f10](https://github.com/constructive-io/pgsql-parser/commit/0961f10243939076c459e7c684899a82078438c0))
- add Integer node handling for SET TRANSACTION boolean options ([bd4ae81](https://github.com/constructive-io/pgsql-parser/commit/bd4ae81bfe0d74bab5527f8f9943c07805652683))
- add JOIN alias support with parentheses wrapping ([79cd1ca](https://github.com/constructive-io/pgsql-parser/commit/79cd1ca8e7d2e2c6a3d11c8aef423542f81219f9))
- add join_using_alias support in JoinExpr method ([819a5ce](https://github.com/constructive-io/pgsql-parser/commit/819a5ce073fb586a3996ec30d4df8fda3fa16585))
- add LANGUAGE and FUNCTION object type support to GrantStmt ([2b79fc3](https://github.com/constructive-io/pgsql-parser/commit/2b79fc3b7e1c6492263f155f75f1449d392fa4ee))
- add List handling for ALTER OPERATOR DefElem arguments - resolves commutator operator name parsing to achieve 96.9% pass rate ([639a043](https://github.com/constructive-io/pgsql-parser/commit/639a043dc2eff89807ab5df180ec76fafc3aaba3))
- add minus operator to pure operator regex for ALTER OPERATOR statements ([e93e5d5](https://github.com/constructive-io/pgsql-parser/commit/e93e5d5470f8c3260389df5890dfd78bcd9c2162))
- add missing AlterTypeStmt method to deparser ([7178604](https://github.com/constructive-io/pgsql-parser/commit/717860499ae51d2745acc589efa1d3729c64f8e8))
- add missing CONSTR_IDENTITY and partbound handling in deparser ([6151157](https://github.com/constructive-io/pgsql-parser/commit/6151157f66a16efdc4eab31052b76e4d3e1180dd))
- add missing CONSTR_IDENTITY constraint type support for GENERATED ALWAYS AS IDENTITY columns ([f4a9ba3](https://github.com/constructive-io/pgsql-parser/commit/f4a9ba33c8a8ccb4ff41fec8a5650f3b17810f7e))
- add missing ON COMMIT clause handling to CreateTableAsStmt - resolves temp test failure ([c2ad00b](https://github.com/constructive-io/pgsql-parser/commit/c2ad00b61ad1be9c044853e938c12912fc2e59b0))
- add missing PartitionCmd node type handler for ALTER TABLE partition operations ([c045307](https://github.com/constructive-io/pgsql-parser/commit/c045307409f4d4fbd9cd5b8e9d174a54a0bb7294))
- add missing SET option support to GrantRoleStmt method ([81d928d](https://github.com/constructive-io/pgsql-parser/commit/81d928d7dccca903ccc906d5b9b8e9f9bb4c1ef5))
- add missing StatsElem method for CREATE STATISTICS statements ([1945eab](https://github.com/constructive-io/pgsql-parser/commit/1945eabfb2c559dda94edeb524db260504c72a6a))
- add NATURAL JOIN support to JoinExpr method ([c3b3bf2](https://github.com/constructive-io/pgsql-parser/commit/c3b3bf247015fb7427bd2859d7ff4428dbf0e2ed))
- add necessary enum type annotations to resolve TypeScript compilation errors ([4461136](https://github.com/constructive-io/pgsql-parser/commit/4461136ac0b2e1ae7db5372f94f2d89d722a6959))
- add NO INHERIT support to CHECK constraints in Constraint method ([eec4c0e](https://github.com/constructive-io/pgsql-parser/commit/eec4c0ec42f68685fadd3aac81740a3ea4d47c8f))
- add null safety checks to DeleteStmt for WITH RECURSIVE handling ([d83e6f9](https://github.com/constructive-io/pgsql-parser/commit/d83e6f912cf0c0c8e8e16a947fd8d437b3e7b9cd))
- add NULLS NOT DISTINCT clause support to IndexStmt method ([9e7f1c7](https://github.com/constructive-io/pgsql-parser/commit/9e7f1c710bb909d7d7e757c29191850df61dd38a))
- add OBJECT_ATTRIBUTE support to RenameStmt ([6f7ef9d](https://github.com/constructive-io/pgsql-parser/commit/6f7ef9d29dcea2af070d0e3e202f2aefa52d819f))
- add OBJECT_DOMAIN support to AlterOwnerStmt for ALTER DOMAIN OWNER TO statements ([e1a1acd](https://github.com/constructive-io/pgsql-parser/commit/e1a1acd43438f75f6840701d1f94732cc9024435))
- add OBJECT_FDW support to CommentStmt for FOREIGN DATA WRAPPER syntax ([d16f187](https://github.com/constructive-io/pgsql-parser/commit/d16f187f3796ff74f2bf87828fc37e85a240859b))
- add OBJECT_PROCEDURE support in AlterFunctionStmt ([455bbb0](https://github.com/constructive-io/pgsql-parser/commit/455bbb0354b12031c34c7a82b9aa9174d605dd17))
- add OBJECT_PROCEDURE support in GrantStmt ([f63ae55](https://github.com/constructive-io/pgsql-parser/commit/f63ae5581de966b8c1d2c497237f12c201c070bf))
- add OBJECT_STATISTIC_EXT case to CommentStmt for COMMENT ON STATISTICS ([77a6478](https://github.com/constructive-io/pgsql-parser/commit/77a6478518c3e814e53a9146ddf53db11a71c74c))
- add OBJECT_TABCONSTRAINT support to RenameStmt method ([fe5a34a](https://github.com/constructive-io/pgsql-parser/commit/fe5a34a74e3a8a7aacc06e979552b10824da91c7))
- add OBJECT_TYPE support to AlterOwnerStmt for ALTER TYPE ... OWNER TO statements ([5342396](https://github.com/constructive-io/pgsql-parser/commit/53423960929409e2fb54ad54987a51c7655f82ff))
- add OBJECT_TYPE support to AlterTableStmt ([3b63d98](https://github.com/constructive-io/pgsql-parser/commit/3b63d985365936a790c1545cc8e7957a590dfa51))
- add OBJECT_VIEW support in RenameStmt OBJECT_COLUMN case ([a4bf45d](https://github.com/constructive-io/pgsql-parser/commit/a4bf45daddab1e769ce5a92347a6390eafdd864b))
- add ON CONFLICT WHERE clause and MultiAssignRef support ([886b560](https://github.com/constructive-io/pgsql-parser/commit/886b560af422e211621f161c73969494a65dfa1d))
- add optional trim character support to TRIM function SQL syntax ([e45214e](https://github.com/constructive-io/pgsql-parser/commit/e45214e4f1d7a2e51e8e79c717ed5f0cb5dbb2fe))
- add OR REPLACE support for CREATE AGGREGATE statements in DefineStmt ([2858fbf](https://github.com/constructive-io/pgsql-parser/commit/2858fbf3e19197466fdb2b622088929c7da6c962))
- add ORDER BY syntax support for ordered-set aggregates in CREATE AGGREGATE ([ea3f4cd](https://github.com/constructive-io/pgsql-parser/commit/ea3f4cdb8f2524691577df0b280edf53f35fa130))
- add OVERLAPS operator infix syntax support in FuncCall method ([031c1f7](https://github.com/constructive-io/pgsql-parser/commit/031c1f791470e48ba5d1c16aaa37e5231f32db1a))
- add partition specification support to CREATE TABLE statements ([bd8e83b](https://github.com/constructive-io/pgsql-parser/commit/bd8e83b6220b565ceefa5541d0326c7164c286e2))
- add proper identity column options formatting in CONSTR_IDENTITY case ([d24d0be](https://github.com/constructive-io/pgsql-parser/commit/d24d0be0d4c78be9e2a757a50ea0b6b2c0e7b5bc))
- add proper quoting for column names in IndexElem method ([d861ec0](https://github.com/constructive-io/pgsql-parser/commit/d861ec0cd09bce212ecad9e41b12e738aeb4767d))
- add proper quoting for FDW option names containing spaces or special characters in DefElem method ([03610fd](https://github.com/constructive-io/pgsql-parser/commit/03610fd56e3cbeeb9d6484eb0d9dca997549c9f9))
- add proper single quote handling for enum values in CreateEnumStmt ([d9115ba](https://github.com/constructive-io/pgsql-parser/commit/d9115bac711a9377da6cf53fceb4b65217ff98df))
- add REFERENCING clause support to CreateTrigStmt deparser ([d1bed92](https://github.com/constructive-io/pgsql-parser/commit/d1bed929410cac9cabedda459631daeb37e72dc8))
- add RENAME ATTRIBUTE clause for OBJECT_ATTRIBUTE ([f37925f](https://github.com/constructive-io/pgsql-parser/commit/f37925f7d1a7a86643036e7b31646734d4102671))
- add reserved word 'all' to SET statement value quoting ([51a2644](https://github.com/constructive-io/pgsql-parser/commit/51a264423977a6f02ebc787a8c0477a8dcc8c15e))
- add SET TRANSACTION ISOLATION LEVEL support ([d6dba1e](https://github.com/constructive-io/pgsql-parser/commit/d6dba1e2d0738528e203da31b41ce99372b7f286))
- add SUBSTRING, POSITION, and OVERLAY special SQL syntax handling in FuncCall method ([1d0b11d](https://github.com/constructive-io/pgsql-parser/commit/1d0b11dd94e1f516776ba220c17a0418d09e3af5))
- add TEMPORARY keyword support in CreateTableAsStmt method ([8c28a9e](https://github.com/constructive-io/pgsql-parser/commit/8c28a9e7f7f2e4c0081bc05926f423856b15b830))
- add TEMPORARY keyword support to CreateSeqStmt method ([a5e2a55](https://github.com/constructive-io/pgsql-parser/commit/a5e2a55bb375cdb87041e04611487ef38a6c0a38))
- add timestamp type aliases and CREATE TABLE WITH options support ([1ee5d40](https://github.com/constructive-io/pgsql-parser/commit/1ee5d40db2c43ef3b21320cf9c5da129512e2b3b))
- add timestamptz precision modifier placement - precision goes before 'with time zone' ([23572d3](https://github.com/constructive-io/pgsql-parser/commit/23572d34985ebd8cf4f77c2ee113b8d309bd7874))
- add TYPE and DOMAIN object type support to GrantStmt ([8dc8f1e](https://github.com/constructive-io/pgsql-parser/commit/8dc8f1e02aba32d8b0babbe910d65705c57e9e85))
- add undefined node filtering to CreateSeqStmt options processing ([7efaa81](https://github.com/constructive-io/pgsql-parser/commit/7efaa819f0243e227e1bb1d99ec0e6b7c9d48fd4))
- add USING clause support to ALTER COLUMN TYPE statements ([cdeb99a](https://github.com/constructive-io/pgsql-parser/commit/cdeb99a7631700e43ce9b20ca07bdf371068de2d))
- add USING clause support to CreateTableAsStmt for materialized views ([9efc683](https://github.com/constructive-io/pgsql-parser/commit/9efc683da21ca5533392a2cf32e938048a7cab81))
- add USING clause support to JoinExpr method ([c1085b2](https://github.com/constructive-io/pgsql-parser/commit/c1085b25b4da90716d0b97708f685cb8c50f3dd7))
- add USING INDEX clause support for UNIQUE constraints ([21cdc6d](https://github.com/constructive-io/pgsql-parser/commit/21cdc6d927ff489d3f02dc2985cc47b75280c6f6))
- add VARIADIC parameter duplication for ordered-set aggregates ([0588fe0](https://github.com/constructive-io/pgsql-parser/commit/0588fe035ba342d322262b159e235f854c2652aa))
- add WHERE clause support to ON CONFLICT statements ([a424e69](https://github.com/constructive-io/pgsql-parser/commit/a424e690a192ef46f54b7b31399d1be93cda385f))
- add wildcard (\*) support for COMMENT ON AGGREGATE statements ([e43181d](https://github.com/constructive-io/pgsql-parser/commit/e43181d5731567e5b391eab6b9a5e04eb9902a1b))
- add wildcard (\*) support for CREATE AGGREGATE statements ([ae80299](https://github.com/constructive-io/pgsql-parser/commit/ae80299c3f1b39fa51162aa5bdaf9bd22cfa57a8))
- add WITH ADMIN FALSE support to GrantRoleStmt ([d39b4c5](https://github.com/constructive-io/pgsql-parser/commit/d39b4c5d7e7723add14c619e24829484da643edd))
- add WITHIN GROUP clause support for aggregate functions ([41cd750](https://github.com/constructive-io/pgsql-parser/commit/41cd7504872345f7aab2f14f44f89139fec96e1e))
- AlterTSConfigurationStmt dictionary mapping syntax - improve pass rate to 93.3% (11 failed, 152 passed) ([ddeb4d6](https://github.com/constructive-io/pgsql-parser/commit/ddeb4d6413c49e87f996580ad2c569f8dd5eba45))
- attempt to preserve char syntax in TypeCast context ([a3104d4](https://github.com/constructive-io/pgsql-parser/commit/a3104d4f9650528b186254c938b836fd9b7adce6))
- call WithClause method directly in SelectStmt to resolve missing WITH keyword issue ([aff80b9](https://github.com/constructive-io/pgsql-parser/commit/aff80b9bff9250da2c6e63173c26e35bc702758c))
- change SET statement syntax from = to TO and improve quote handling ([0bab0e3](https://github.com/constructive-io/pgsql-parser/commit/0bab0e30de3c07bd2223aa3c76504643541aaf8c))
- consolidate duplicate CONSTR_IDENTITY cases in Constraint method ([291e563](https://github.com/constructive-io/pgsql-parser/commit/291e563de6ede9eeb75f73e61b89d9505d1e6df9))
- continue CREATE OPERATOR DefElem improvements - work in progress ([c03e3c8](https://github.com/constructive-io/pgsql-parser/commit/c03e3c84b218fd4ae55b1a0758a309b86c09d402))
- correct canlogin role option to use LOGIN instead of CANLOGIN ([a77a4c1](https://github.com/constructive-io/pgsql-parser/commit/a77a4c1852b82c451d6e2930148cf1122db01143))
- correct CommentStmt object name handling to use dot-separated identifiers ([53cf219](https://github.com/constructive-io/pgsql-parser/commit/53cf21980b7d9d429a178ccb78935af99f89e758))
- correct DeclareCursorStmt cursor options bitmask decoding ([45c8a13](https://github.com/constructive-io/pgsql-parser/commit/45c8a13b24475a671fb0b8697af09e725b7a2e0e))
- correct DeclareCursorStmt SCROLL option bit flag mapping ([0e95175](https://github.com/constructive-io/pgsql-parser/commit/0e9517543bb4749435a34be0d4dafd35b5d3438f))
- correct DeclareCursorStmt WITH HOLD bitmask from 16 to 32 - improves pass rate to 94.5% (9 failed, 154 passed) ([1cd3230](https://github.com/constructive-io/pgsql-parser/commit/1cd323027d64de397481cfece8f45b9ec92762f7))
- correct DROP POLICY syntax handling and improve WindowDef parentheses logic ([e74ad29](https://github.com/constructive-io/pgsql-parser/commit/e74ad29acabda73fc87cc419956ac51b435d3178))
- correct FetchStmt direction and ALL handling logic ([1198c3b](https://github.com/constructive-io/pgsql-parser/commit/1198c3b98f675555e1be6672df7d85f8473b3d09))
- correct GrantStmt objtype handling for regular GRANT/REVOKE statements ([b3809dc](https://github.com/constructive-io/pgsql-parser/commit/b3809dc757c2680944a1adda049f8dfe00f07428))
- correct interval type field specification formatting ([675745b](https://github.com/constructive-io/pgsql-parser/commit/675745b76b6c0bc81174dcad812a281450f56512))
- correct interval type modifier mapping - resolve 2048 -> minute instead of hour to second ([0dc8629](https://github.com/constructive-io/pgsql-parser/commit/0dc862976955c6eea2a475e4bbbe9c6668dfd3b1))
- correct LockStmt lock mode array indexing - PostgreSQL uses 1-based mode values (1-8) not 0-based (0-7) ([621a681](https://github.com/constructive-io/pgsql-parser/commit/621a68177b02e127159055ce769e637bf77b4569))
- correct LockStmt lock mode mapping - revert to original PostgreSQL order ([58d6009](https://github.com/constructive-io/pgsql-parser/commit/58d6009632fc11229c85ae865025bb17a2aebf1e))
- correct LockStmt lock mode mapping - swap SHARE and SHARE UPDATE EXCLUSIVE positions ([05322c1](https://github.com/constructive-io/pgsql-parser/commit/05322c1d47d439db1a744ffbb990cc6f176e5480))
- correct REPLICATION role option handling in DefElem method ([1c72d8b](https://github.com/constructive-io/pgsql-parser/commit/1c72d8b7d6e0b6276f70b1f87da1ce7b57b9ee02))
- correct TableLikeClause bitfield mapping for INCLUDING options ([6621876](https://github.com/constructive-io/pgsql-parser/commit/66218765b35ef2d8f729d207446b172a7623ed5d))
- correct timetz type modifier placement - precision goes before 'with time zone' ([9f6ec6d](https://github.com/constructive-io/pgsql-parser/commit/9f6ec6d01a082dbd5b085d1c7f53a1fc519e1ff8))
- CREATE OPERATOR DefElem case preservation and update TESTS.md with accurate full test suite status (29 failed, 323 passed, 91.8% pass rate) ([fa60814](https://github.com/constructive-io/pgsql-parser/commit/fa60814486fdecd5ec0aa101f633f63aa85ebd93))
- CREATE TABLE WITH options DefElem context handling ([064eb06](https://github.com/constructive-io/pgsql-parser/commit/064eb06da7a8258852fe81df3dac575bd0efcbba))
- CreateForeignTableStmt context - pass proper parentNodeTypes when visiting relation ([dc75030](https://github.com/constructive-io/pgsql-parser/commit/dc750308e5429e9df14523be9a5be20b6c67fb4e))
- enhance Constraint method with domain context handling and CONSTR_GENERATED support ([634fb4b](https://github.com/constructive-io/pgsql-parser/commit/634fb4b979c15f71253900cf4201ea223a2c8f9b))
- enhance DeleteStmt and deparseReturningList with comprehensive error handling ([d6eadbf](https://github.com/constructive-io/pgsql-parser/commit/d6eadbf69b55f2c1f2cdb3af2397257dc265ced4))
- enhance JOIN alias handling for nested cases ([5aa8768](https://github.com/constructive-io/pgsql-parser/commit/5aa8768beee694b58f8f29e30cefaefd8ff37621))
- enhance RangeFunction with comprehensive null safety and nested List handling ([d270416](https://github.com/constructive-io/pgsql-parser/commit/d270416e8713b5544a32cf52a678b03edd65813d))
- enhance RangeFunction with undefined node filtering and error handling ([21c79e7](https://github.com/constructive-io/pgsql-parser/commit/21c79e73ffa9e1fb1a2de9525c7d8c4aaa889626))
- expand needsQuotes logic to handle all-uppercase identifiers ([df6c0f1](https://github.com/constructive-io/pgsql-parser/commit/df6c0f1843b1ad481d0d017ebc6c5dded352cf84))
- extend DEFERRABLE constraint support to PRIMARY KEY and UNIQUE constraints ([b24a7eb](https://github.com/constructive-io/pgsql-parser/commit/b24a7eb27a9451de0289ba239824e0997a3ae639))
- handle ALTER TYPE syntax correctly ([4b5aacd](https://github.com/constructive-io/pgsql-parser/commit/4b5aacd122f8678c36ebc4ea0b865f013d32a662))
- handle empty object structures in A_Const to resolve INSERT statement [object Object] issues ([6dd0b38](https://github.com/constructive-io/pgsql-parser/commit/6dd0b388707343c4ad2e2136d781b970feb9762b))
- handle FETCH RELATIVE with undefined howMany - defaults to 0 for proper syntax preservation ([051bc90](https://github.com/constructive-io/pgsql-parser/commit/051bc907bb8b5c0dfeb8b29ee3cd687b4aa148ad))
- handle List nodes properly in AT_SetOptions and AT_ResetOptions ([fe919e3](https://github.com/constructive-io/pgsql-parser/commit/fe919e34a08291e75ede981dca4f305de147dda3))
- handle nested ival structure in SET TRANSACTION boolean options ([8707e0b](https://github.com/constructive-io/pgsql-parser/commit/8707e0b7beaae78ef0991c8bd9f505f59d9096c1))
- implement case sensitivity preservation in String method and QuoteUtils ([e786823](https://github.com/constructive-io/pgsql-parser/commit/e786823ed28464dcc29ff39d4bef36eca6ccf6cc))
- implement context-aware string handling for GrantStmt and DefElem ([db5ed0b](https://github.com/constructive-io/pgsql-parser/commit/db5ed0b30a3002a00adcbd2f4adda2126f1b54c5))
- implement direct OVER clause formatting in FuncCall method to resolve window function parentheses issue ([14f3cbf](https://github.com/constructive-io/pgsql-parser/commit/14f3cbf6d5cd68870662d7c353a1a2b3bb4c7a89))
- implement GrantStmt object type handling and remove inappropriate behavior clauses ([16fccf9](https://github.com/constructive-io/pgsql-parser/commit/16fccf993baa07307e922f850da513885a1477ba))
- implement proper context passing for ALTER TYPE operations ([a1ce6e0](https://github.com/constructive-io/pgsql-parser/commit/a1ce6e0eb6839d895a23a30fb0d705de809496b6))
- implement proper DROP POLICY syntax and add parentheses to WindowDef OVER clauses ([43e4d53](https://github.com/constructive-io/pgsql-parser/commit/43e4d532ffff866b25f463f2b0f584cf1b1814f1))
- implement proper MultiAssignRef detection for multi-column assignments ([818ef09](https://github.com/constructive-io/pgsql-parser/commit/818ef09925e6fac5e584d4998b24c0aa34679f8b))
- implement proper object type handling in GrantStmt for ACL_TARGET_ALL_IN_SCHEMA ([a94da24](https://github.com/constructive-io/pgsql-parser/commit/a94da246592c9a5a137cc3c0cf5ee9d0058e7149))
- implement REVOKE INHERIT OPTION FOR syntax in GrantRoleStmt and update TESTS.md with verified full test suite status (30 failed, 322 passed, 91.5% pass rate) ([56ec13f](https://github.com/constructive-io/pgsql-parser/commit/56ec13f737fab04e9d8e009eb3263b743de9c9ba))
- implement standard SQL CAST() syntax in TypeCast method - major improvement from 84→70 failed test suites ([9162d29](https://github.com/constructive-io/pgsql-parser/commit/9162d295f9d98957b362c63cd840629e0118cc71))
- improve A_Const method with better null handling and object structure edge cases ([52e0a93](https://github.com/constructive-io/pgsql-parser/commit/52e0a93490969d91a02f49f51872916aabff2207))
- improve alias column name quoting to prevent double-quote issues ([6795135](https://github.com/constructive-io/pgsql-parser/commit/6795135c2b4c142ec3a952f0ac6dc053872e7025))
- improve AST mismatch handling in deparser ([6fdda56](https://github.com/constructive-io/pgsql-parser/commit/6fdda56e640876b14184f6e5c363b2a4b450e186))
- improve COMMENT ON CONSTRAINT handling for table constraints ([0ef047b](https://github.com/constructive-io/pgsql-parser/commit/0ef047bfcef76423c854acac2b62573a9ced2431))
- improve CommentStmt object type mapping and AlterEnumStmt string escaping ([16dbfc3](https://github.com/constructive-io/pgsql-parser/commit/16dbfc32a3144b783a72db0ef97b084e5ab47f4d))
- improve CommentStmt string escaping for single quotes in multi-line comments ([f2ff00e](https://github.com/constructive-io/pgsql-parser/commit/f2ff00e9408cbbdebce495acb0343e1ddd455f92))
- improve CREATE TYPE DefElem context handling for Integer and TypeName nodes ([e671e8d](https://github.com/constructive-io/pgsql-parser/commit/e671e8d60f95afa7cc5e86e641414742b89c39cf))
- improve GrantRoleStmt admin option handling ([277fd25](https://github.com/constructive-io/pgsql-parser/commit/277fd25752b2d853f156d4f768b411bae78b69b6))
- improve GrantRoleStmt admin option handling and AlterRoleStmt GROUP/ROLE detection ([b9543c9](https://github.com/constructive-io/pgsql-parser/commit/b9543c91276948e59f344640078b24a564b87910))
- improve interval field mapping with single modifier handling - address SELECT '999'::interval second parsing ([2e65aee](https://github.com/constructive-io/pgsql-parser/commit/2e65aeea645b8938b92f7a9ecc8e69d851fa918d))
- improve interval type modifier mapping and precision handling ([033e2b9](https://github.com/constructive-io/pgsql-parser/commit/033e2b95f821e5a1143193e146bbf30ad6d6c35f))
- improve plpgsql compatibility with orderedarray type casting and quoted parameter names ([dbac0c5](https://github.com/constructive-io/pgsql-parser/commit/dbac0c5cbfc4d41eacca22d589e09f6a79e67079))
- improve SET TRANSACTION statement formatting ([cc52244](https://github.com/constructive-io/pgsql-parser/commit/cc522444ff2b4c9be30349072baa3879d0421df5))
- improve type modifier filtering in formatTypeMods method ([faaf617](https://github.com/constructive-io/pgsql-parser/commit/faaf6178855e70730b3d4a88dc51967d3c64874b))
- improve TypeCast and TypeName for built-in types ([66068e2](https://github.com/constructive-io/pgsql-parser/commit/66068e2d00ac2cc7f4ddc396fab47f825ec1f252))
- improve undefined node filtering in AlterSeqStmt method ([8311757](https://github.com/constructive-io/pgsql-parser/commit/8311757919078db2267eb67a8ee6ae257d499f7d))
- improve varchar and interval type handling in TypeName method ([6770195](https://github.com/constructive-io/pgsql-parser/commit/6770195673ca0537511b9cffd707215f57f26f3a))
- include OBJECT_MATVIEW in AlterObjectSchemaStmt relation handling - resolves missing table name in ALTER MATERIALIZED VIEW SET SCHEMA statements ([c3e66de](https://github.com/constructive-io/pgsql-parser/commit/c3e66de2b531f0b1cf702f4fdc0b2cd0aaf3cb62))
- include USING clause for all access methods in IndexStmt ([12f7e30](https://github.com/constructive-io/pgsql-parser/commit/12f7e30d2a6c207549da09bae877589fb386aee4))
- inline RangeVar and RoleSpec wrapped nodes to resolve TypeScript compilation errors ([78a8600](https://github.com/constructive-io/pgsql-parser/commit/78a8600eb0c66d479f14ba99bd02774bedc888aa))
- make file operations Windows-compatible ([6edf87f](https://github.com/constructive-io/pgsql-parser/commit/6edf87f6536cce7c1da481ab2572c0d53fb0904c))
- only output CASCADE for ADD operations, not RESTRICT ([6c785a6](https://github.com/constructive-io/pgsql-parser/commit/6c785a6231730d4a5e14e0c3fddf92af391bea3a))
- only output CASCADE for ALTER COLUMN TYPE, not RESTRICT ([5b49db4](https://github.com/constructive-io/pgsql-parser/commit/5b49db4e8abfabd6cf65e1f74aae729458dd238d))
- only output CASCADE for RENAME operations, not RESTRICT ([94e1521](https://github.com/constructive-io/pgsql-parser/commit/94e15212083f3a2cf5bce80e2bc87a9e69bf37a6))
- preserve :: syntax for char types in TypeCast method ([00b3151](https://github.com/constructive-io/pgsql-parser/commit/00b31514d0dd1935e138d65ce1973f447711aa94))
- preserve identifier quoting for PostgreSQL keywords in TypeName method ([03ab203](https://github.com/constructive-io/pgsql-parser/commit/03ab20345b1a6db3b61ceeef66797ce6a270a62a))
- preserve namespace prefixes in DefElem for ALTER TABLE SET options ([19f0c48](https://github.com/constructive-io/pgsql-parser/commit/19f0c48c412523fff84d800aa105e54de0938bc6))
- preserve parentheses around SELECT statements in UNION ALL operations ([5396b08](https://github.com/constructive-io/pgsql-parser/commit/5396b0890ee8d5ac939da312597c39fd2f2ecaf6))
- preserve quoted case for CREATE OPERATOR boolean flags (Hashes, Merges) ([7d1df28](https://github.com/constructive-io/pgsql-parser/commit/7d1df28979513ca9a0de3ada3e36f21e33f5480c))
- preserve quoted CREATE TYPE attribute names like "Passedbyvalue" ([6ad41c0](https://github.com/constructive-io/pgsql-parser/commit/6ad41c09b5fda8cb81b99495a967653f35e77bf8))
- preserve quoted identifiers in ALTER SEQUENCE OWNED BY clause ([e05874a](https://github.com/constructive-io/pgsql-parser/commit/e05874a8e8fae1fd699c9f3841ad93c7f5f1d6dc))
- preserve quoted identifiers in CREATE AGGREGATE DefineStmt ([dc907bc](https://github.com/constructive-io/pgsql-parser/commit/dc907bce7577320c2f1612c455786262e9155291))
- preserve single quotes for String literals in CREATE AGGREGATE DefineStmt ([6e26233](https://github.com/constructive-io/pgsql-parser/commit/6e262333643c435225c427a32140d5fab18c9707))
- preserve traditional char 'value' syntax for pg_catalog.bpchar typecasts - resolves char test suite ([78d6ca9](https://github.com/constructive-io/pgsql-parser/commit/78d6ca907a1efa7c581c0e4a6e90a991604b51a2))
- prevent ONLY keyword for ALTER TYPE operations in RenameStmt ([84d55a2](https://github.com/constructive-io/pgsql-parser/commit/84d55a20203457853569d19d5293cf445327d48a))
- prevent quoting of operator symbols in CREATE OPERATOR statements ([09fd5aa](https://github.com/constructive-io/pgsql-parser/commit/09fd5aa237b7656857080d045d6d6b48780a3250))
- prevent quoting of operator symbols in ObjectWithArgs ([4a2185e](https://github.com/constructive-io/pgsql-parser/commit/4a2185e99ef47fbba67bf9e9b04a483676f55355))
- remove extra spaces around parentheses in CREATE TYPE DefineStmt ([a6e61c0](https://github.com/constructive-io/pgsql-parser/commit/a6e61c05aa85a5c48d0f426fd266e53995c95f08))
- remove extra spaces in ObjectWithArgs parentheses formatting ([2a23998](https://github.com/constructive-io/pgsql-parser/commit/2a2399888ff4990853c826b7deb6efaa94c23199))
- remove ObjectWithArgs exception from String method and RESTRICT keyword from DropStmt to resolve schema name quoting and DROP FUNCTION test failures ([9485ee1](https://github.com/constructive-io/pgsql-parser/commit/9485ee1296f1d73638d3a45b634d7af419312cef))
- remove RangeVar wrappers and inline node properties across all test files ([41a98bf](https://github.com/constructive-io/pgsql-parser/commit/41a98bf5f8f0ef2f89199ed2710b80588464d59a))
- remove RoleSpec wrappers and inline node properties across test files ([b9f7151](https://github.com/constructive-io/pgsql-parser/commit/b9f7151652679ce3b13f031aafe372456d24627d))
- remove unnecessary enum type casting from test files ([bcb4fc0](https://github.com/constructive-io/pgsql-parser/commit/bcb4fc05291cf20afa35c02abe5544a3a8923af7))
- remove unnecessary quotes from pg_catalog.char type name ([51320c7](https://github.com/constructive-io/pgsql-parser/commit/51320c7e60a2d2ebda76e8f93168a801924b5864))
- resolve A_Indirection and ResTarget field access handling - improved from 70→69 failed test suites ([70cad69](https://github.com/constructive-io/pgsql-parser/commit/70cad6983b464405aff042d9078224f04435a2c8))
- resolve AccessPriv column name quoting in GRANT statements - improved from 62→61 failed test suites ([1a9a785](https://github.com/constructive-io/pgsql-parser/commit/1a9a785baf9340301984d012c0934e007d5b0d78))
- resolve ALTER DOMAIN schema.domain name formatting ([dd335e7](https://github.com/constructive-io/pgsql-parser/commit/dd335e7bf72fe91ce266be654b28b7471efcec80))
- resolve ALTER FOREIGN DATA WRAPPER OPTIONS clause formatting with proper string quoting and spacing ([19b93e6](https://github.com/constructive-io/pgsql-parser/commit/19b93e6a83c87aaf2b7933f0fd88da75be700c7d))
- resolve ALTER OPERATOR CLASS schema handling ([49453a5](https://github.com/constructive-io/pgsql-parser/commit/49453a5395698abfe69d4e6e407ce6c3829aabd8))
- resolve ALTER OPERATOR SET clause function name quoting ([5a42a93](https://github.com/constructive-io/pgsql-parser/commit/5a42a935b0d649f56f2a1f451d6a9173933c4487))
- resolve ALTER TABLE SET SCHEMA relation handling ([108539b](https://github.com/constructive-io/pgsql-parser/commit/108539b00df5554f190c7653e2355ed588d845a9))
- resolve ALTER VIEW RENAME COLUMN issue - add relationType check for OBJECT_VIEW in RenameStmt OBJECT_COLUMN case ([f90a66c](https://github.com/constructive-io/pgsql-parser/commit/f90a66c35e42ac5c9dfc5ad0cb275fe3f047bd27))
- resolve AlterRoleSetStmt kind node type error by calling VariableSetStmt directly ([d88d070](https://github.com/constructive-io/pgsql-parser/commit/d88d07060c02dabca304acae498763bce3bb6721))
- resolve AlterRoleSetStmt role name handling and TO syntax for ALTER ROLE SET statements ([8ded126](https://github.com/constructive-io/pgsql-parser/commit/8ded12650efa8221bd2dbcb496c813c83c72029f))
- resolve AlterTableCmd ADD COLUMN generated column issue ([767bfbf](https://github.com/constructive-io/pgsql-parser/commit/767bfbfcdb28018012551ba45e1e7710e17289d7))
- resolve AlterTableStmt visitor pattern issue by calling methods directly ([68d811e](https://github.com/constructive-io/pgsql-parser/commit/68d811e470ed49cfe66eb74c5c2d94693eb2bf6a))
- resolve bit test AST mismatches by preserving pg_catalog prefixes and removing unnecessary TypeCast parentheses ([9923498](https://github.com/constructive-io/pgsql-parser/commit/99234986d37a375ac4f1a3a522efc27edb2e9f59))
- resolve BitString hex formatting, RenameStmt role handling, and LockStmt mode mapping ([04ba6fc](https://github.com/constructive-io/pgsql-parser/commit/04ba6fcdc6fb57ee67b177d242240548159fcff9))
- resolve BitString literal formatting in A_Const method ([ad23037](https://github.com/constructive-io/pgsql-parser/commit/ad230379b3fe7949c9d51e697fa9e9ce4222ec2f))
- resolve COLLATION FOR function SQL syntax preservation ([0550375](https://github.com/constructive-io/pgsql-parser/commit/055037534f2068409e156cdb6f956bc509dd6457))
- resolve column name quoting in GrantStmt and update TESTS.md with accurate full test suite status (29 failed, 323 passed, 91.8% pass rate) ([543141b](https://github.com/constructive-io/pgsql-parser/commit/543141b7d9d0249a4e1c767f45ab42a79b60fcf0))
- resolve CompositeTypeStmt generated column issue ([3129c1d](https://github.com/constructive-io/pgsql-parser/commit/3129c1d22252bbaa76126a5a54dd54b6f98cdba7))
- resolve CREATE AGGREGATE DefineStmt case sensitivity and quoting issues ([3155196](https://github.com/constructive-io/pgsql-parser/commit/3155196186ed1dd846ad95cc8684750a9cf607e2))
- resolve CREATE FUNCTION parameter formatting and DefElem SET clause duplication ([00b0e9e](https://github.com/constructive-io/pgsql-parser/commit/00b0e9e7e0e750bac0362ae1f16716130bb9a2ba))
- resolve CREATE OPERATOR COMMUTATOR/NEGATOR quoting - operators now unquoted correctly ([6476d44](https://github.com/constructive-io/pgsql-parser/commit/6476d440bd3c30d427893c5c474bd048f708191e))
- resolve CREATE PROCEDURE parsing issues ([4044199](https://github.com/constructive-io/pgsql-parser/commit/40441998f5c9e12461e28fa67998a4041b5db012))
- resolve CREATE ROLE DefElem options - add password, validUntil, and adminmembers keyword format support ([00bf9a6](https://github.com/constructive-io/pgsql-parser/commit/00bf9a68c56a1375196e6ef1a544d98043230e27))
- resolve CREATE ROLE isreplication DefElem handling - improved from 63→62 failed test suites ([32c74db](https://github.com/constructive-io/pgsql-parser/commit/32c74dbdc0fd89fa2ce50774643bc3ec9645b132))
- resolve CREATE USER MAPPING server name quoting ([397e078](https://github.com/constructive-io/pgsql-parser/commit/397e078dd35c5842161254909901062956cad0bb))
- resolve create_index test suite failures ([423c4fe](https://github.com/constructive-io/pgsql-parser/commit/423c4fe879f9d408c3b5b56038cde57a60dc5d91))
- resolve CreateAmStmt amtype mapping from single characters to full words (i->INDEX, t->TABLE) ([5dfe617](https://github.com/constructive-io/pgsql-parser/commit/5dfe617ea968098e4147ca48dbd48706c57a318d))
- resolve CreateCastStmt function parameter handling ([f315b0e](https://github.com/constructive-io/pgsql-parser/commit/f315b0eabd68d3730b7d46dfb1fa929aafbc3b00))
- resolve CreateEventTrigStmt PROCEDURE keyword and RenameStmt quoting issues ([be857c4](https://github.com/constructive-io/pgsql-parser/commit/be857c4e03a34487de61505f8c3e471dbc3b2d58))
- resolve CreateFunctionStmt multiple body string handling for latest-postgres-create_function_sql test ([45668b8](https://github.com/constructive-io/pgsql-parser/commit/45668b808e5a2cead7fe54c3378359ee064ec7ec))
- resolve CreateUserMappingStmt DefElem OPTIONS equals format - removed from space format conditional to allow proper key=value formatting ([2f28fb1](https://github.com/constructive-io/pgsql-parser/commit/2f28fb1cd1c3bcf5e19bba8eb9ab95b2e9ded0b5))
- resolve CreateUserMappingStmt DefElem OPTIONS format - use space separator instead of equals for PostgreSQL compliance ([8150bf9](https://github.com/constructive-io/pgsql-parser/commit/8150bf97c64636834897e827324790a1be549d9a))
- resolve DeclareCursorStmt SCROLL option regression - restore 92% pass rate ([1cb9314](https://github.com/constructive-io/pgsql-parser/commit/1cb93148e06935a3bc3b14b0e4d15dc6b7b2a548))
- resolve DISTINCT clause handling in FuncCall and Aggref methods ([01687ee](https://github.com/constructive-io/pgsql-parser/commit/01687ee1d1c318bf3bc5d5188025f93bc39bb06f))
- resolve domain constraint handling for ADD/DROP CONSTRAINT operations ([cb1cf1d](https://github.com/constructive-io/pgsql-parser/commit/cb1cf1dcc4c2ba8c6145affa7fee5dd34a0e0110))
- resolve DoStmt argument ordering issue ([ed93955](https://github.com/constructive-io/pgsql-parser/commit/ed93955b4a65b3dd1037d21cc5d1f4a75a8b282b))
- resolve DoStmt LANGUAGE clause ordering for arrays test ([b77bf04](https://github.com/constructive-io/pgsql-parser/commit/b77bf04022455bf7f2f7db62bd96ac32af0d1b21))
- resolve DoStmt nested dollar quoting conflicts with unique tag generation ([637eb1b](https://github.com/constructive-io/pgsql-parser/commit/637eb1b3a2cea239598722569f4b297de9f9c12c))
- resolve DROP AGGREGATE wildcard handling and remove automatic RESTRICT behavior ([b0d612a](https://github.com/constructive-io/pgsql-parser/commit/b0d612a621ebd434b9b4fb8aa0f026babd70fd4c))
- resolve DROP OPERATOR CLASS USING clause ordering for 3-item AST structure ([abcfd0b](https://github.com/constructive-io/pgsql-parser/commit/abcfd0bdf9f0b209b47026c071b6954701891b22))
- resolve DROP TABLE schema-qualified name AST structure issue ([c75130a](https://github.com/constructive-io/pgsql-parser/commit/c75130a8a49e43e712f856ba3355800f6ee2a392))
- resolve EXCLUDE constraint operator quoting issue - operators like = and && no longer incorrectly quoted ([5282d2e](https://github.com/constructive-io/pgsql-parser/commit/5282d2e447a984b91f9ef52a5e861615c86535c8))
- resolve FetchStmt ALL sentinel value handling for FETCH ALL statements ([7970aac](https://github.com/constructive-io/pgsql-parser/commit/7970aace714973db1159d0f20a8af6c937a8ef02))
- resolve foreign key constraint handling with DEFERRABLE attributes, SET CONSTRAINTS statements, and ALTER CONSTRAINT operations ([fc24dc9](https://github.com/constructive-io/pgsql-parser/commit/fc24dc996711b98b6c5cf44b6a9b6468787994c6))
- resolve foreign table partition syntax by removing empty parentheses for partitioned foreign tables ([e14dd84](https://github.com/constructive-io/pgsql-parser/commit/e14dd845f22d2203d4933048844f5dbf8c85a531))
- resolve function spacing, GRANT privileges, and pg_catalog type AST mismatches ([84ac16f](https://github.com/constructive-io/pgsql-parser/commit/84ac16f4e6097e67e77ed481a0c5622f4e61e3a2))
- resolve GrantRoleStmt admin option regression - improved from 74→72 failed tests ([484a593](https://github.com/constructive-io/pgsql-parser/commit/484a593c5942a0ba659d45274519550cecb6b2ac))
- resolve GrantStmt schema handling and RoleSpec roletype support ([67df951](https://github.com/constructive-io/pgsql-parser/commit/67df951f9b578fe87ecea214f0c01851f1442f44))
- resolve ImportForeignSchemaStmt OPTIONS formatting and CreateForeignTableStmt INHERITS clause handling ([73d2617](https://github.com/constructive-io/pgsql-parser/commit/73d26177d12658d57864caf743a6a6d0be0bd716))
- resolve JOIN expression parentheses handling - avoid double parentheses when nested JOINs have aliases ([860a0a5](https://github.com/constructive-io/pgsql-parser/commit/860a0a547ec8bc7b0836ad6a25bdbea96021f3d7))
- resolve JOIN vs INNER JOIN formatting issue in create_view test ([2fb257b](https://github.com/constructive-io/pgsql-parser/commit/2fb257b697a22e883cc836d5003ba27ce5069119))
- resolve JoinExpr NATURAL/CROSS JOIN handling and ViewStmt numeric options ([cc6bbf2](https://github.com/constructive-io/pgsql-parser/commit/cc6bbf21fc6783e37aa951fe981373d7a6f67d30))
- resolve LockStmt lock mode mapping and add missing TABLE keyword - correct mode 3 to ROW EXCLUSIVE instead of SHARE UPDATE EXCLUSIVE ([32692ed](https://github.com/constructive-io/pgsql-parser/commit/32692eddf8d360bb2e2d2e114dc8616262da6f1f))
- resolve LockStmt lock mode mapping and CreateUserMappingStmt server name quoting ([7d563b2](https://github.com/constructive-io/pgsql-parser/commit/7d563b20ffc566ebe4ba3628edc19f84ba45ee7b))
- resolve LockStmt PostgreSQL compatibility - add TABLE keyword and correct 1-based lock mode mapping ([db94ee5](https://github.com/constructive-io/pgsql-parser/commit/db94ee5e93787a74f36c5b8276ab1ce172e36048))
- resolve missing table name in RuleStmt deparser ([52bf7ec](https://github.com/constructive-io/pgsql-parser/commit/52bf7ec69293535aa616658a6b2eed4d1e078dde))
- resolve multi-dimensional array handling and char type conversion ([1d8f921](https://github.com/constructive-io/pgsql-parser/commit/1d8f9212ec5381c5c74b9056ccbe08b5ebbaaeb3))
- resolve multiple deparser issues ([bb22845](https://github.com/constructive-io/pgsql-parser/commit/bb2284519507b7c5f5c9217c6bdedaac00f901de))
- resolve NamedArgExpr and DropStmt issues ([95ca63c](https://github.com/constructive-io/pgsql-parser/commit/95ca63c2cfb05736e43ea53104505939eb284bd4))
- resolve NO MINVALUE/NO MAXVALUE sequence option handling in DefElem method ([605ead5](https://github.com/constructive-io/pgsql-parser/commit/605ead5801a70d4607f001cfcdb7fcadabd26db1))
- resolve numeric value quoting in CREATE TABLE WITH options ([0726ceb](https://github.com/constructive-io/pgsql-parser/commit/0726ceb4d1caad242d5e733698e7242b91c2b1f4))
- resolve OBJECT_RULE quoting in RenameStmt - use QuoteUtils.quote() to preserve case-sensitive identifiers like "\_RETURN" ([591f7a1](https://github.com/constructive-io/pgsql-parser/commit/591f7a1eb9d2bcfd0d3b7a96c995d1d20c26f67a))
- resolve PASSWORD NULL DefElem control flow issue and update TESTS.md with accurate full test suite status (30 failed, 322 passed, 91.5% pass rate) ([2deb462](https://github.com/constructive-io/pgsql-parser/commit/2deb46213ddb8a4a303761a3214242c6636fc7ff))
- resolve RangeFunction double AS issue for function calls with column definitions ([9e2e36c](https://github.com/constructive-io/pgsql-parser/commit/9e2e36c039ae79214bd72167c8ba2984f24184e0))
- resolve RenameStmt OBJECT_POLICY handling to include policy name and ON keyword ([29d01de](https://github.com/constructive-io/pgsql-parser/commit/29d01def7f4d2307b675e8fcd44903d05b1ad658))
- resolve RenameStmt OBJECT_SCHEMA handling - include schema name from subname field ([546e6b2](https://github.com/constructive-io/pgsql-parser/commit/546e6b2751012a09393f40bfd35ddd694b73b3c9))
- resolve RenameStmt regression - improved from 81→66 failed test suites ([96ad6c8](https://github.com/constructive-io/pgsql-parser/commit/96ad6c8ea2b6a60eda9e04749f77e7e4f3910d99))
- resolve ReplicaIdentityStmt duplicate REPLICA IDENTITY output ([8dd723b](https://github.com/constructive-io/pgsql-parser/commit/8dd723b5cf84fb002f760c868a4842f6957dfecf))
- resolve stack overflow in CreateForeignTableStmt and CreateTransformStmt deparser methods ([3b3b09b](https://github.com/constructive-io/pgsql-parser/commit/3b3b09b88805c282e5d3c802faa4328edfa7e442))
- resolve TransactionStmt boolean value parsing for READ WRITE/DEFERRABLE ([424d361](https://github.com/constructive-io/pgsql-parser/commit/424d3618bf2dc325cf531bdb36baa3419578c8ae))
- resolve TransactionStmt isolation level property access issue ([0593689](https://github.com/constructive-io/pgsql-parser/commit/0593689e5f5fd98605f203204919201bda39b701))
- resolve union AST mismatch by adding parentheses around set operation operands with ORDER BY/LIMIT clauses ([72f4d1f](https://github.com/constructive-io/pgsql-parser/commit/72f4d1f01594b9a06e4c2a36f6a7d09feb0e4139))
- resolve VariableSetStmt empty string handling for SET statements ([935c36d](https://github.com/constructive-io/pgsql-parser/commit/935c36d9f61f46f15f785fd9e86fddbfc6b35ccd))
- resolve VARIADIC function call placement - apply VARIADIC to last argument instead of first ([05e27b6](https://github.com/constructive-io/pgsql-parser/commit/05e27b63eb1198d91603b4e9e711822c8270ed08))
- resolve window frame specification issue in FuncCall method ([1f79854](https://github.com/constructive-io/pgsql-parser/commit/1f798549af28dac882e74ade1d82a4c10fc93c83))
- resolve WITH clause handling in UpdateStmt ([878cb30](https://github.com/constructive-io/pgsql-parser/commit/878cb304c4047cd6caa887a1fdd2f24d835783ba))
- resolve WITH clause nested parentheses and TypeCast CAST syntax preservation ([7230717](https://github.com/constructive-io/pgsql-parser/commit/72307176251612acdd89c0967a1f20357c4c1b3e))
- restore context-aware interval TypeCast formatting - resolves SELECT '999'::interval second parsing to achieve 93.9% pass rate ([67173c1](https://github.com/constructive-io/pgsql-parser/commit/67173c152f0ca117184bed68a57dd63942e19acd))
- restore ObjectWithArgs exception and update TESTS.md with accurate full test suite status (29 failed, 323 passed, 91.8% pass rate) ([9314886](https://github.com/constructive-io/pgsql-parser/commit/93148868b590495f471c59290358b189e43c5e50))
- restructure XmlExpr method with early XMLPI handling ([a7d2e3a](https://github.com/constructive-io/pgsql-parser/commit/a7d2e3a1764993fe0a5192bfd5334d09247f5917))
- revert duck typing in getNodeType() and update TESTS.md with accurate status ([5224b8e](https://github.com/constructive-io/pgsql-parser/commit/5224b8e390e84332c8dc0d9689026dce36548d08))
- schema name quoting - use pure operator regex to prevent hyphen conflicts in identifiers ([562d278](https://github.com/constructive-io/pgsql-parser/commit/562d27835ddf3df645692c40a69040fb3ea7d738))
- simplify getNodeType() and getNodeData() to resolve stack overflow issues ([ad2ab20](https://github.com/constructive-io/pgsql-parser/commit/ad2ab2048c805674dfca5815d11922968e1f7bf3))
- standardize AST typing and remove unnecessary enum type casting in deparser tests ([83e7b1e](https://github.com/constructive-io/pgsql-parser/commit/83e7b1e8e139b9a9a93026a5480285256533c43e))
- standardize String node format and add A_Expr_Kind import in deparser.test.ts ([167c531](https://github.com/constructive-io/pgsql-parser/commit/167c5317f44be7e27b2d07287af8f1304f0a58e9))
- update getNodeType() for wrapped/unwrapped nodes and update TESTS.md with accurate status (30 failed, 322 passed) ([6c1c4dd](https://github.com/constructive-io/pgsql-parser/commit/6c1c4dd8337be3cd50c21c26601fc5725a079efd))
- use ALTER ATTRIBUTE for ALTER TYPE operations ([c8833b3](https://github.com/constructive-io/pgsql-parser/commit/c8833b3d3d9662ca7ebc02fbe2cefff5b18ccec6))
- use direct ObjectWithArgs call in AlterFunctionStmt to preserve function arguments ([741dd8c](https://github.com/constructive-io/pgsql-parser/commit/741dd8c3ecbe83178ef97f4a7e9ae8054c2443ff))
- use DROP ATTRIBUTE for ALTER TYPE operations ([d4ee379](https://github.com/constructive-io/pgsql-parser/commit/d4ee379d73cdfb8a91f839e2327b7b47c08d2270))
- use DROP ATTRIBUTE IF EXISTS for ALTER TYPE operations ([ef78bd1](https://github.com/constructive-io/pgsql-parser/commit/ef78bd12bb78bacbf2573ad3e9a4c391f705962b))

### Features

- achieve 100% test pass rate (352/352) - complete PostgreSQL 13-17 deparser compatibility ([59e38ee](https://github.com/constructive-io/pgsql-parser/commit/59e38ee2134ee32263c1e4934dee243e6f0375ab))
- add comprehensive progress documentation and improve A_Expr parentheses handling ([bb2a5af](https://github.com/constructive-io/pgsql-parser/commit/bb2a5af548eefe6a6980a3c3ede2b1547e787e1b))
- add DefineStmt OBJECT_TSCONFIGURATION support and update progress ([e713786](https://github.com/constructive-io/pgsql-parser/commit/e713786578ed114e5ee2eda27a40034abb03fb91))
- add GENERATED column support to ColumnDef method ([c48155f](https://github.com/constructive-io/pgsql-parser/commit/c48155fb21af725537387045af6450953f89217a))
- add missing_ok support to AlterTableCmd ADD COLUMN operation ([60df636](https://github.com/constructive-io/pgsql-parser/commit/60df6363878f65542833f54bb75a3ddb56d43a6f))
- add piecewise deparser testing and improve RangeFunction error handling ([d11122f](https://github.com/constructive-io/pgsql-parser/commit/d11122f3b56ccc3292e1a35217cd428254955b56))
- add VAR_SET_MULTI support and TransactionStmt options handling ([af47a34](https://github.com/constructive-io/pgsql-parser/commit/af47a34755209c9d37533beec972313bdc93f003))
- fix A_Indirection parentheses and update progress documentation ([eb60481](https://github.com/constructive-io/pgsql-parser/commit/eb604813720625ac97a7e09d0ad2d053b484bbea))
- implement 23 additional AlterTableCmd subtypes for comprehensive PostgreSQL 17 support ([af06bd6](https://github.com/constructive-io/pgsql-parser/commit/af06bd6b61120e7b6d1a9e224df45ee53898a2e4))
- implement comprehensive AlterTableCmd subtypes - expand from 7 to 30+ supported ALTER TABLE operations ([9f32dcf](https://github.com/constructive-io/pgsql-parser/commit/9f32dcf63b93fd6f285e0231d7266a9ea9d8ff4a))
- implement comprehensive deparser improvements ([b268c41](https://github.com/constructive-io/pgsql-parser/commit/b268c413aa66a32609a96be0e4af8c8be2783442))
- implement comprehensive object type support in DropStmt and RenameStmt ([f1285c1](https://github.com/constructive-io/pgsql-parser/commit/f1285c1050ae265888ee959269d4e43c20ddf3ec))
- implement context array propagation in visit method - enables proper parent node tracking for nested contexts ([ab57d0a](https://github.com/constructive-io/pgsql-parser/commit/ab57d0a340ec0363ddc3b2e000197ab11d364c82))
- implement missing AlterDomainStmt subtypes and RenameStmt object types ([75181ac](https://github.com/constructive-io/pgsql-parser/commit/75181ac218cfc842a5ea06752d098b368213f368))
- migrate to required parentNodeTypes array context system ([06fea43](https://github.com/constructive-io/pgsql-parser/commit/06fea43a407a3cd8d1577aca53e53dd79c46db06))
- migrate to robust array-based context system ([8407d85](https://github.com/constructive-io/pgsql-parser/commit/8407d855fee71560dc54016afcd85bf42556763c))
- rebuild PostgreSQL deparser with visitor-based architecture ([e6ecf04](https://github.com/constructive-io/pgsql-parser/commit/e6ecf0450cdbee2ab608af99eddd910ae3e453e8))
