# Publishing Guide

`main` tracks PostgreSQL 18. The PostgreSQL 18 packages are the workspace packages themselves and are
published from the root with `pnpm lerna publish` (dist-tag `latest`).

`pgsql-parser` and `pgsql-deparser` are also published for PostgreSQL 13–17, each under its own npm
dist-tag (`pg13` … `pg17`). Those packages are generated from `main` on demand; nothing about them is
committed apart from the version numbers in `config/versions.json`.

Publishing a generated package must always pass `--tag pgNN`. Without it npm moves `latest`, which
has to stay on 18.

## How a generated package is built

### `pgsql-deparser` for major N (13–17)

There is one deparser: the PostgreSQL 18 one in `packages/deparser/src`. The package for major N is
that deparser plus the AST transformers from `packages/transform-ast` that upgrade an N tree to an
18 tree:

```
PG N AST  ──  PGNToPG18Transformer  ──▶  PG 18 AST  ──  Deparser (18)  ──▶  SQL
```

`npm run prepare-versions` in `packages/deparser` runs these scripts in order:

| Script | What it does |
|--------|--------------|
| `strip-transformer-types` | Copies `transform-ast/src/transformers/vN-to-vN+1.ts` (13→14 … 17→18) into `versions/`, replacing the `@pgsql/types` version imports with `any` |
| `strip-direct-transformer-types` | Same for `transform-ast/src/transformers-direct/vN-to-v18/index.ts`, written to `versions/direct/vN-to-v18.ts` |
| `strip-deparser-types` | Copies `packages/deparser/src` into `versions/N/src/deparser/` with the `@pgsql/types` imports replaced by `any` |
| `organize-transformers` | Moves each major's chain (`vN-to-vN+1.ts` … `v17-to-v18.ts`) and its `vN-to-v18-direct.ts` into `versions/N/src/` |
| `generate-version-deparsers` | Writes `versions/N/src/index.ts`: a `Deparser` that runs `PGNToPG18Transformer` and hands the result to the 18 deparser |
| `generate-packages` | Writes `versions/N/package.json` (version and `@pgsql/types` range from `config/versions.json`, `@pgsql/quotes` at the workspace version), tsconfigs, README, and `versions/pnpm-workspace.yaml` |

Every step exits non-zero if a source file is missing.

### `pgsql-parser` for major N (13–17)

`npm run prepare-versions` in `packages/parser` (`scripts/prepare-versions.ts`) writes
`versions/N/` for every major in `config/versions.json` except the workspace's own (18). Each
package is a thin re-export of three pinned dependencies taken from `config/versions.json`:

- `libpg-query` — the parser for that major
- `pgsql-deparser` — the generated deparser for that major (exact version)
- `@pgsql/types` — the types for that major

Because of the exact `pgsql-deparser` pin, **the deparser for a major must be on npm before the
parser for that major can be installed, built or published.**

### `versions/` directories

`packages/deparser/versions` and `packages/parser/versions` are gitignored and are their own pnpm
workspaces (each gets a `pnpm-workspace.yaml`). They are not part of the root workspace, so run
`pnpm install` inside `versions/` after every `prepare-versions`.

## `config/versions.json`

One entry per major:

```json
"17": {
  "libpg-query": "17.8.3",
  "pgsql-parser": "17.10.0",
  "pgsql-deparser": "17.19.0",
  "@pgsql/types": "17.6.2",
  "npmTag": "pg17"
}
```

- `pgsql-parser` / `pgsql-deparser`: the version the next publish of that major will produce.
- `libpg-query` / `@pgsql/types`: what the generated packages pin. Both are published from other
  repositories.
- The `18` entry is not used for generation; 18 is versioned by lerna.

`pnpm bump-versions` (`scripts/bump-versions.ts`) edits this file interactively. For each major it
reads the major's dist-tag on npm for all four packages, then:

- sets `libpg-query` and `@pgsql/types` to whatever the `pgNN` dist-tag points at (no prompt);
- prompts for `pgsql-parser` and `pgsql-deparser`: `latest` (when npm is ahead of the file),
  `patch`, `minor`, `custom`, or `skip`;
- prints a summary and asks whether to save.

Choose `skip` for every major you are not publishing, and commit the result.

## Publishing one major

Example for 17; replace `17` / `pg17` for another major.

1. Build the workspace and set the versions:

   ```bash
   pnpm install
   pnpm build
   pnpm bump-versions
   ```

2. Generate, build and publish the deparser:

   ```bash
   cd packages/deparser
   npm run prepare-versions
   cd versions
   pnpm install
   cd 17
   npm run build
   cd dist
   npm publish --tag pg17
   ```

3. Generate, build and publish the parser (needs step 2 to be on npm):

   ```bash
   cd packages/parser
   npm run prepare-versions
   cd versions
   pnpm install
   cd 17
   npm run build
   cd dist
   npm publish --tag pg17
   ```

4. Check that only the `pgNN` tag moved:

   ```bash
   npm view pgsql-deparser dist-tags
   npm view pgsql-parser dist-tags
   ```

`pnpm install` in `packages/parser/versions` resolves every generated major, so each
`pgsql-deparser` version listed in `config/versions.json` for 13–17 has to exist on npm at that
point.
