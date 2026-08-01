import { downloadProtoFile, generateProtoJS, replaceTextInProtoJS } from './helpers';

export interface CommandOptions {
  help?: boolean;
  h?: boolean;
  version?: boolean;
  v?: boolean;
  protoUrl?: string;
  inFile: string;
  outFile: string;
  originalPackageName: string;
  newPackageName: string;
}

export const help = (): void => {
  console.log(`
  Usage:
  
  pg-proto-parser protogen --protoUrl <URL to proto file>
                     --inFile <path to proto file>
                     --outFile <path to output JS file>
                     --originalPackageName <original package name>
                     --newPackageName <new package name>

  Options:
  
  --help, -h                 Show this help message.
  --version, -v              Show the version number.
  --protoUrl                 Full URL to download the proto file (optional).
  --inFile                   Path where the proto file will be saved or path to an existing proto file.
  --outFile                  Path where the generated JavaScript file will be saved.
  --originalPackageName      Original package name to be replaced in the JS file.
  --newPackageName           New package name to replace in the JS file.
  `);
};

export default async (argv: CommandOptions): Promise<CommandOptions> => {

  try {
    if (argv.protoUrl) {
      await downloadProtoFile(argv.protoUrl, argv.inFile);
    }
    await generateProtoJS(argv.inFile, argv.outFile);
    await replaceTextInProtoJS(argv.outFile, argv.originalPackageName, argv.newPackageName);
    console.log('All operations completed successfully.');
  } catch (error) {
    // @ts-ignore
    console.error('An error occurred:', error.message);
  }

  return argv;
};
