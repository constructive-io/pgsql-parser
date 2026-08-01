import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join } from 'path';

export function showVersion() {
  // Try to find package.json in various locations
  const possiblePaths = [
    join(process.cwd(), 'package.json'),
    join(process.argv[1], '../../package.json'),
    join(process.argv[1], '../../../package.json')
  ];
  
  for (const path of possiblePaths) {
    try {
      const packageJson = JSON.parse(readFileSync(path, 'utf-8'));
      if (packageJson.name === '@pgsql/cli') {
        console.log(packageJson.version);
        return;
      }
    } catch {
      // Continue to next path
    }
  }
  
  // Fallback: just show the version we know
  console.log('1.29.2');
}

export function showHelp(command?: string) {
  if (command) {
    switch (command) {
    case 'parse':
      showParseHelp();
      break;
    case 'deparse':
      showDeparseHelp();
      break;
    case 'proto-gen':
      showProtoGenHelp();
      break;
    case 'proto-fetch':
      showProtoFetchHelp();
      break;
    case 'runtime-schema':
      showRuntimeSchemaHelp();
      break;
    default:
      showGeneralHelp();
    }
  } else {
    showGeneralHelp();
  }
}

function showGeneralHelp() {
  console.log(`
${chalk.bold('pgsql')} - Unified CLI for PostgreSQL AST operations

${chalk.yellow('Usage:')}
  pgsql <command> [options]

${chalk.yellow('Commands:')}
  ${chalk.green('parse')}           Parse SQL to AST
  ${chalk.green('deparse')}         Convert AST to SQL
  ${chalk.green('proto-gen')}       Generate TypeScript from protobuf
  ${chalk.green('proto-fetch')}     Download and process proto files
  ${chalk.green('runtime-schema')}  Generate runtime schema for AST nodes

${chalk.yellow('Global Options:')}
  -h, --help       Show help
  -v, --version    Show version

${chalk.yellow('Examples:')}
  pgsql parse query.sql
  pgsql deparse ast.json
  pgsql proto-gen --inFile pg_query.proto --outDir out
  pgsql proto-fetch --url https://example.com/pg_query.proto --inFile pg_query.proto

Run 'pgsql <command> --help' for detailed help on a specific command.
`);
}

function showParseHelp() {
  console.log(`
${chalk.bold('pgsql parse')} - Parse SQL to AST

${chalk.yellow('Usage:')}
  pgsql parse <sqlfile> [options]

${chalk.yellow('Options:')}
  -o, --output <file>    Output to file instead of stdout
  -f, --format <format>  Output format: json, pretty (default: pretty)
  --clean                Clean the AST tree (remove location info)
  -h, --help            Show help

${chalk.yellow('Examples:')}
  pgsql parse query.sql
  pgsql parse query.sql -o ast.json
  pgsql parse query.sql --format json --clean
`);
}

function showDeparseHelp() {
  console.log(`
${chalk.bold('pgsql deparse')} - Convert AST to SQL

${chalk.yellow('Usage:')}
  pgsql deparse [options]

${chalk.yellow('Options:')}
  -i, --input <file>     Input JSON file (or use stdin)
  -o, --output <file>    Output to file instead of stdout
  -h, --help            Show help

${chalk.yellow('Examples:')}
  pgsql deparse -i ast.json
  pgsql deparse -i ast.json -o query.sql
  cat ast.json | pgsql deparse
  pgsql parse query.sql | pgsql deparse
`);
}

function showProtoGenHelp() {
  console.log(`
${chalk.bold('pgsql proto-gen')} - Generate TypeScript from protobuf

${chalk.yellow('Usage:')}
  pgsql proto-gen --inFile <proto> --outDir <dir> [options]

${chalk.yellow('Required Options:')}
  --inFile <file>        Input .proto file
  --outDir <dir>         Output directory

${chalk.yellow('Optional Flags:')}
  --enums                Generate TypeScript enums
  --enums-json           Generate JSON enum mappings
  --types                Generate TypeScript interfaces
  --utils                Generate utility functions
  --ast-helpers          Generate AST helper methods
  --wrapped-helpers      Generate wrapped AST helpers
  --optional             Make all fields optional
  --keep-case            Keep original field casing
  --remove-undefined     Remove UNDEFINED enum at position 0
  -h, --help            Show help

${chalk.yellow('Examples:')}
  pgsql proto-gen --inFile pg_query.proto --outDir out --types --enums
  pgsql proto-gen --inFile pg_query.proto --outDir out --types --utils --ast-helpers
  pgsql proto-gen --inFile pg_query.proto --outDir out --types --optional --keep-case
`);
}

function showProtoFetchHelp() {
  console.log(`
${chalk.bold('pgsql proto-fetch')} - Download and process proto files

${chalk.yellow('Usage:')}
  pgsql proto-fetch [options]

${chalk.yellow('Options:')}
  --url <url>            Proto file URL to download
  --inFile <file>        Where to save the proto file
  --outFile <file>       Generated JS output file
  --replace-pkg <old>    Original package name to replace
  --with-pkg <new>       New package name
  -h, --help            Show help

${chalk.yellow('Examples:')}
  pgsql proto-fetch --url https://raw.githubusercontent.com/pganalyze/libpg_query/16-latest/protobuf/pg_query.proto \\
                    --inFile pg_query.proto \\
                    --outFile pg_query.js \\
                    --replace-pkg "protobufjs/minimal" \\
                    --with-pkg "@launchql/protobufjs/minimal"
`);
}

function showRuntimeSchemaHelp() {
  console.log(`
${chalk.bold('pgsql runtime-schema')} - Generate runtime schema for AST nodes

${chalk.yellow('Usage:')}
  pgsql runtime-schema --inFile <proto> --outDir <dir> [options]

${chalk.yellow('Required Options:')}
  --inFile <file>        Input .proto file
  --outDir <dir>         Output directory

${chalk.yellow('Optional Options:')}
  --format <format>      Output format: json, typescript (default: json)
  --filename <name>      Output filename (default: runtime-schema)
  -h, --help            Show help

${chalk.yellow('Examples:')}
  pgsql runtime-schema --inFile pg_query.proto --outDir out
  pgsql runtime-schema --inFile pg_query.proto --outDir out --format typescript
  pgsql runtime-schema --inFile pg_query.proto --outDir out --filename ast-schema
`);
}