# Publishing Guide

This guide covers the multi-version publishing workflow for the pgsql-parser monorepo, which supports PostgreSQL versions 13-17 with version-specific npm tags.

## Prerequisites

Before publishing any packages, you must build the entire monorepo:

```bash
pnpm install && pnpm build
```

This installs all dependencies and builds all packages in the correct order using Lerna.

## Multi-Version Publishing Overview

The pgsql-parser project uses a sophisticated multi-version publishing system to support different PostgreSQL versions. Each PostgreSQL version has its own:

- **Version numbers** for each package (parser, deparser, types)
- **npm tag** for publishing (pg13, pg14, pg15, pg16, pg17)
- **libpg-query dependency** version

All version mappings are centrally managed in `config/versions.json`:

```json
{
  "versions": {
    "13": {
      "libpg-query": "13.5.7",
      "pgsql-parser": "13.18.0", 
      "pgsql-deparser": "13.17.0",
      "@pgsql/types": "13.11.1",
      "npmTag": "pg13"
    },
    "17": {
      "libpg-query": "17.5.5",
      "pgsql-parser": "17.7.5",
      "pgsql-deparser": "17.8.3", 
      "@pgsql/types": "17.6.1",
      "npmTag": "pg17"
    }
  }
}
```

### 0. Bump the config versions

In the root:

```
pnpm bump-versions
```

## Package Publishing Workflows

### 1. Deparser Package (`pgsql-deparser`)

The deparser package uses a template-based approach for multi-version publishing.

#### Prepare Versions
```bash
cd packages/deparser
npm run prepare-versions
```

This runs a complete preparation pipeline:
1. `strip-transformer-types` - Clean up transformer types
2. `strip-direct-transformer-types` - Clean up direct transformer types  
3. `strip-deparser-types` - Clean up deparser types
4. `organize-transformers` - Organize transformers by version
5. `generate-version-deparsers` - Generate version-specific deparsers
6. `generate-packages` - Generate package.json files for each version

The `generate-packages` script (`scripts/generate-version-packages.ts`):
- Uses the template from `config/deparser-versions.json`
- Creates version-specific packages in `packages/deparser/versions/`
- Sets up proper dependencies and npm tags for each PostgreSQL version

#### Build and Publish Individual Versions
```bash
# Navigate to a specific version directory
cd packages/deparser/versions/13

# Build the package
npm run build

# dist
cd dist/

# Publish with the correct tag
npm publish --tag pg13
```

**I do 13,14,15,16... since 17 was already publish from the root `pnpm lerna publish`

Now go to run, fetch fresh versions for config again:

```
pnpm bump-versions
```


#### Publish All Deparser Versions
```bash
cd packages/deparser

# Prepare all versions
npm run prepare-versions

# Build and publish each version
for version in versions/*/; do
  cd "$version"
  npm run build
  cd dist/
  npm run publish:pkg  # Uses the npmTag from config
  cd ..
done
```

### 2. Parser Package (`pgsql-parser`)

The parser package uses a version preparation script to generate multiple version-specific packages.

#### Prepare Versions
```bash
cd packages/parser
npm run prepare-versions
```

This script (`scripts/prepare-versions.ts`):
- Reads version configuration from `config/versions.json`
- Creates version-specific directories in `packages/parser/versions/`
- Generates `package.json`, `tsconfig.json`, and source files for each PostgreSQL version
- Each version gets its own libpg-query dependency and npm tag

#### Build and Publish Individual Versions
```bash
# Navigate to a specific version directory
cd packages/parser/versions/13

# Build the package
npm run build

# cd to dist/

cd dist/

# Publish with the correct tag
npm publish --tag pg13
```

#### Publish All Parser Versions
```bash
cd packages/parser

# Prepare all versions
npm run prepare-versions

# Build and publish each version
for version in versions/*/; do
  cd "$version"
  npm run build
  npm run publish:pkg  # Uses the npmTag from config
  cd ..
done
```

