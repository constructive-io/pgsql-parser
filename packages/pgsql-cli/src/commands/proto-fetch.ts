import chalk from 'chalk';

import { showHelp } from '../utils/help';
import { downloadProtoFile, generateProtoJS, replaceTextInProtoJS } from './proto-fetch/helpers';

export async function protoFetchCommand(argv: any) {
  if (argv.help) {
    showHelp('proto-fetch');
    process.exit(0);
  }

  const url = argv.url;
  const inFile = argv.inFile;
  const outFile = argv.outFile;
  const replacePkg = argv['replace-pkg'] || 'protobufjs/minimal';
  const withPkg = argv['with-pkg'] || '@launchql/protobufjs/minimal';

  if (!inFile || !outFile) {
    console.error(chalk.red('Error: --inFile and --outFile are required'));
    showHelp('proto-fetch');
    process.exit(1);
  }

  try {
    if (url) {
      console.log(chalk.blue(`Downloading proto file from ${url}...`));
      await downloadProtoFile(url, inFile);
      console.log(chalk.green(`✓ Proto file saved to ${inFile}`));
    }
    
    console.log(chalk.blue('Generating JavaScript from proto file...'));
    await generateProtoJS(inFile, outFile);
    
    console.log(chalk.blue(`Replacing package references...`));
    await replaceTextInProtoJS(outFile, replacePkg, withPkg);
    
    console.log(chalk.green(`✓ All operations completed successfully`));
    console.log(chalk.green(`✓ Generated file: ${outFile}`));
  } catch (error: any) {
    console.error(chalk.red('Proto fetch error:'), error.message || error);
    process.exit(1);
  }
}