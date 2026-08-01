import chalk from 'chalk';
import { readFileSync, writeFileSync } from 'fs';
import { join,resolve } from 'path';
import { deparse } from 'pgsql-deparser';

import { showHelp } from '../utils/help';

export async function deparseCommand(argv: any) {
  if (argv.help) {
    showHelp('deparse');
    process.exit(0);
  }

  try {
    let ast;
    
    // Read AST from file or stdin
    if (argv.input || argv.i) {
      const inputFile = argv.input || argv.i;
      const filePath = inputFile.startsWith('/')
        ? inputFile
        : resolve(join(process.cwd(), inputFile));
      
      const content = readFileSync(filePath, 'utf-8');
      ast = JSON.parse(content);
    } else if (!process.stdin.isTTY) {
      // Read from stdin
      const chunks = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString();
      ast = JSON.parse(content);
    } else {
      console.error(chalk.red('Error: No input provided. Use -i <file> or pipe input via stdin'));
      showHelp('deparse');
      process.exit(1);
    }
    
    // Deparse AST to SQL
    const sql = await deparse(ast);
    
    // Write output
    if (argv.output || argv.o) {
      const outputFile = argv.output || argv.o;
      writeFileSync(outputFile, sql);
      console.log(chalk.green(`✓ SQL written to ${outputFile}`));
    } else {
      process.stdout.write(sql);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error(chalk.red(`Error: File not found: ${argv.input || argv.i}`));
    } else if (error instanceof SyntaxError) {
      console.error(chalk.red('Error: Invalid JSON input'));
    } else {
      console.error(chalk.red('Deparse error:'), error.message || error);
    }
    process.exit(1);
  }
}