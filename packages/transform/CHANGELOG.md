# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [18.17.2](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.17.1...@pgsql/transform@18.17.2) (2026-08-07)

**Note:** Version bump only for package @pgsql/transform

## [18.17.1](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.16.0...@pgsql/transform@18.17.1) (2026-08-07)

**Note:** Version bump only for package @pgsql/transform

# [18.16.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.15.3...@pgsql/transform@18.16.0) (2026-08-06)

### Bug Fixes

- **transform:** route schema-qualified argument types in identity casts ([1bbd895](https://github.com/constructive-io/pgsql-parser/commit/1bbd8958100ca10438237fc990074208f9dd4aa0))

### Features

- **transform:** route object identities by cast type ([c02bc96](https://github.com/constructive-io/pgsql-parser/commit/c02bc96f7ca98036f374ac2f7fcd643588554505))

## [18.15.3](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.15.2...@pgsql/transform@18.15.3) (2026-08-05)

### Performance Improvements

- **transform:** reuse compiled schema regexes and skip absent schemas ([50fdb2f](https://github.com/constructive-io/pgsql-parser/commit/50fdb2f55d9061900336e94c94f14798ccdf69c1))

## [18.15.2](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.15.1...@pgsql/transform@18.15.2) (2026-08-03)

**Note:** Version bump only for package @pgsql/transform

## [18.15.1](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.15.0...@pgsql/transform@18.15.1) (2026-08-02)

**Note:** Version bump only for package @pgsql/transform

# [18.15.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.14.1...@pgsql/transform@18.15.0) (2026-08-02)

### Features

- **semantics:** extract statement-classification facts into @pgsql/semantics ([ec6c1ce](https://github.com/constructive-io/pgsql-parser/commit/ec6c1ce793fa836f15bead2e21f40e5dd4b18d03))

## [18.14.1](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.14.0...@pgsql/transform@18.14.1) (2026-08-01)

**Note:** Version bump only for package @pgsql/transform

# [18.14.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.13.0...@pgsql/transform@18.14.0) (2026-08-01)

**Note:** Version bump only for package @pgsql/transform

# [18.13.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.11.1...@pgsql/transform@18.13.0) (2026-07-31)

### Features

- **traverse:** one walk() for any AST; walkSql(text) in plpgsql-parser ([9e3af40](https://github.com/constructive-io/pgsql-parser/commit/9e3af405a8ca025139808ba5192ed1cfa2bfdf36))

## [18.11.1](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.11.0...@pgsql/transform@18.11.1) (2026-07-31)

**Note:** Version bump only for package @pgsql/transform

# [18.11.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.10.0...@pgsql/transform@18.11.0) (2026-07-31)

### Features

- **transform:** revertFor/verifyFor — revert and verify script generation from statement facts ([134f0e8](https://github.com/constructive-io/pgsql-parser/commit/134f0e8fafb67db5794356f3eae444510374a7f5))

# [18.10.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.9.0...@pgsql/transform@18.10.0) (2026-07-31)

### Features

- **transform:** PGPM naming spec v1 — identityOf + pathFor (canonical derived change paths) ([cc6da09](https://github.com/constructive-io/pgsql-parser/commit/cc6da09dfd76b69f0fba3553c08eeb09b7d1d16c))

# [18.9.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.8.0...@pgsql/transform@18.9.0) (2026-07-31)

### Features

- **transform:** statement dependency graph + granularity restructuring (atomic/object/consolidated) ([d8dafd2](https://github.com/constructive-io/pgsql-parser/commit/d8dafd2c24b1051deb46178880c0e0b25bd23ca9))

# [18.8.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.7.0...@pgsql/transform@18.8.0) (2026-07-30)

### Features

- **transform:** single routing pass via claims, namespace-aware handlers, statement spans ([537c88e](https://github.com/constructive-io/pgsql-parser/commit/537c88e2b8e48e5fd9247b89b6a1e171210b44b4))

# [18.7.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.6.0...@pgsql/transform@18.7.0) (2026-07-30)

### Features

- **transform:** name rebinding in SchemaRouter (repoint references at a different object) ([34d9216](https://github.com/constructive-io/pgsql-parser/commit/34d92163dff617fe7ae2f727ca1018c4a299c3e7))

# [18.6.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.5.0...@pgsql/transform@18.6.0) (2026-07-30)

### Features

- **transform:** extension + role routing (schema-portable installs, symbol qualification, role renaming) ([fdbb791](https://github.com/constructive-io/pgsql-parser/commit/fdbb7919641fbc52d0a4209a8679b4e97ad6f07b))

# [18.5.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.4.1...@pgsql/transform@18.5.0) (2026-07-29)

### Features

- **transform:** classify references inside LANGUAGE sql function bodies ([b164789](https://github.com/constructive-io/pgsql-parser/commit/b164789f45d3081d9635779c5f36327a61aedde5))

## [18.4.1](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.4.0...@pgsql/transform@18.4.1) (2026-07-29)

**Note:** Version bump only for package @pgsql/transform

# [18.4.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.3.1...@pgsql/transform@18.4.0) (2026-07-29)

### Features

- **transform:** object-level schema routing via SchemaRouter ([0ee037a](https://github.com/constructive-io/pgsql-parser/commit/0ee037a0a182b2f5f8425229d3e7c4777bf41a8e))

## [18.3.1](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.3.0...@pgsql/transform@18.3.1) (2026-07-27)

**Note:** Version bump only for package @pgsql/transform

# [18.3.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@18.1.1...@pgsql/transform@18.3.0) (2026-07-27)

### Features

- add @pgsql/transform (SQL transformation, classification, qualification, closure) ([1e58737](https://github.com/constructive-io/pgsql-parser/commit/1e58737f78e1653f17cdcf34b7bb17aca1666af9))
