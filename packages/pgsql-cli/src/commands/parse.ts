import chalk from 'chalk';
import { readFileSync, writeFileSync } from 'fs';
import { join,resolve } from 'path';
import { parse } from 'pgsql-parser';

import { showHelp } from '../utils/help';

export async function parseCommand(argv: any) {
  if (argv.help) {
    showHelp('parse');
    process.exit(0);
  }

  const sqlFile = argv._[1];
  
  if (!sqlFile) {
    console.error(chalk.red('Error: SQL file required'));
    showHelp('parse');
    process.exit(1);
  }

  try {
    // Resolve file path
    const filePath = sqlFile.startsWith('/')
      ? sqlFile
      : resolve(join(process.cwd(), sqlFile));
    
    // Read SQL content
    const content = readFileSync(filePath, 'utf-8');
    
    // Parse SQL
    const ast = await parse(content);
    
    // Clean AST if requested
    if (argv.clean) {
      // For now, we'll skip the clean functionality until we can import it properly
      console.warn(chalk.yellow('Warning: --clean flag is not yet implemented'));
    }
    
    // Format output
    const format = argv.format || 'pretty';
    const output = format === 'json' 
      ? JSON.stringify(ast)
      : JSON.stringify(ast, null, 2);
    
    // Write output
    if (argv.output) {
      writeFileSync(argv.output, output);
      console.log(chalk.green(`✓ AST written to ${argv.output}`));
    } else {
      process.stdout.write(output);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error(chalk.red(`Error: File not found: ${sqlFile}`));
    } else {
      console.error(chalk.red('Parse error:'), error.message || error);
    }
    process.exit(1);
  }
}