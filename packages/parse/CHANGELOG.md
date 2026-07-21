# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [18.1.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-parse@1.0.0...pgsql-parse@18.1.0) (2026-07-21)

**Note:** Version bump only for package pgsql-parse

# [1.0.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-parse@0.3.0...pgsql-parse@1.0.0) (2026-07-21)

### Features

- PostgreSQL 18 support (libpg-query 18.1.1, @pgsql/types 18) ([a8d5cfe](https://github.com/constructive-io/pgsql-parser/commit/a8d5cfef9422a873a90a5736551bae291bbdff47))

# [0.3.0](https://github.com/constructive-io/pgsql-parser/compare/pgsql-parse@0.2.2...pgsql-parse@0.3.0) (2026-07-21)

**Note:** Version bump only for package pgsql-parse

## [0.2.2](https://github.com/constructive-io/pgsql-parser/compare/pgsql-parse@0.2.1...pgsql-parse@0.2.2) (2026-07-20)

**Note:** Version bump only for package pgsql-parse

## [0.2.1](https://github.com/constructive-io/pgsql-parser/compare/pgsql-parse@0.2.0...pgsql-parse@0.2.1) (2026-07-11)

**Note:** Version bump only for package pgsql-parse

# 0.2.0 (2026-04-09)

### Bug Fixes

- add README.md for pgsql-parse package (fixes build) ([7fd2072](https://github.com/constructive-io/pgsql-parser/commit/7fd20722bef83a589ba27d4452fbf6cfed6fac22))
- preserve trailing comments on the same line as their statement ([62a1e45](https://github.com/constructive-io/pgsql-parser/commit/62a1e45f1ad399a7dcabbaba6a0084f6c1d25cff))
- revert pnpm patch, use inline JSON fix for scanSync upstream bug ([e1ea118](https://github.com/constructive-io/pgsql-parser/commit/e1ea1186535d57de975fe5cba64474f017d12fc2))

### Features

- add pgsql-parse package with comment and whitespace preservation ([84eac19](https://github.com/constructive-io/pgsql-parser/commit/84eac19e74664444a8db23b5335f3f7d551cca38))
- hoist mid-statement comments above their enclosing statement ([048caae](https://github.com/constructive-io/pgsql-parser/commit/048caae0a7640a69d9720c1da5581ba379622b29))
