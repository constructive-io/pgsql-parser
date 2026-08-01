#!/usr/bin/env node
import chalk from 'chalk';
import minimist from 'minimist';

import { deparseCommand } from './commands/deparse';
import { parseCommand } from './commands/parse';
import { protoFetchCommand } from './commands/proto-fetch';
import { protoGenCommand } from './commands/proto-gen';
import { runtimeSchemaCommand } from './commands/runtime-schema';
import { showHelp, showVersion } from './utils/help';

const argv = minimist(process.argv.slice(2), {
  alias: {
    h: 'help',
    v: 'version',
    o: 'output',
    f: 'format'
  }
});

const command = argv._[0];

async function main() {
  try {
    if (argv.version) {
      showVersion();
      process.exit(0);
    }

    if (!command || argv.help) {
      showHelp(command);
      process.exit(0);
    }

    switch (command) {
    case 'parse':
      await parseCommand(argv);
      break;
      
    case 'deparse':
      await deparseCommand(argv);
      break;
      
    case 'proto-gen':
      await protoGenCommand(argv);
      break;
      
    case 'proto-fetch':
      await protoFetchCommand(argv);
      break;
      
    case 'runtime-schema':
      await runtimeSchemaCommand(argv);
      break;
      
    default:
      console.error(chalk.red(`Unknown command: ${command}`));
      showHelp();
      process.exit(1);
    }
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message || error);
    process.exit(1);
  }
}

main();
