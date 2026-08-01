import chalk from 'chalk';
import o from 'nested-obj';
import { getOptionsWithDefaults,PgProtoParser, PgProtoParserOptions } from 'pg-proto-parser';

import { showHelp } from '../utils/help';

export async function protoGenCommand(argv: any) {
  if (argv.help) {
    showHelp('proto-gen');
    process.exit(0);
  }

  if (!argv.inFile || !argv.outDir) {
    console.error(chalk.red('Error: --inFile and --outDir are required'));
    showHelp('proto-gen');
    process.exit(1);
  }

  try {
    const options: PgProtoParserOptions = getOptionsWithDefaults({
      outDir: argv.outDir
    });

    // Set options based on flags
    if (argv.enums) o.set(options, 'enums.enabled', true);
    if (argv['enums-json']) o.set(options, 'enums.json.enabled', true);
    if (argv.types) o.set(options, 'types.enabled', true);
    if (argv.utils) o.set(options, 'utils.enums.enabled', true);
    if (argv['ast-helpers']) o.set(options, 'utils.astHelpers.enabled', true);
    if (argv['wrapped-helpers']) o.set(options, 'utils.wrappedAstHelpers.enabled', true);
    if (argv.optional) o.set(options, 'types.optionalFields', true);
    if (argv['keep-case']) o.set(options, 'parser.keepCase', true);
    if (argv['remove-undefined']) o.set(options, 'enums.removeUndefinedAt0', true);
    
    // Additional options that might be useful
    if (argv['type-union']) o.set(options, 'enums.enumsAsTypeUnion', true);
    if (argv.header) o.set(options, 'includeHeader', true);

    console.log(chalk.blue('Parsing protobuf file...'));
    const parser = new PgProtoParser(argv.inFile, options);
    
    console.log(chalk.blue('Generating TypeScript files...'));
    await parser.write();
    
    console.log(chalk.green(`✓ Files generated in ${argv.outDir}`));
  } catch (error: any) {
    console.error(chalk.red('Proto generation error:'), error.message || error);
    process.exit(1);
  }
}