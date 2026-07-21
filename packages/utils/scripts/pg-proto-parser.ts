import { PgProtoParser, PgProtoParserOptions } from 'pg-proto-parser';
import { resolve, join } from 'path';

const inFile: string = join(__dirname, '../../../__fixtures__/proto/18-latest.proto');
const outDir: string = resolve(join(__dirname, '../src'));

const options: PgProtoParserOptions = {
  outDir,
  types: {
    enabled: false
  },
  enums: {
    enabled: false,
  },
  utils: {
    enums: {
      enabled: false,
    },
    astHelpers: {
      enabled: true,
      typesSource: '@pgsql/types',
    },
    wrappedAstHelpers: {
      enabled: true,
      filename: 'wrapped.ts'
    }
  },
  runtimeSchema: {
    enabled: true,
    filename: 'runtime-schema.ts',
    format: 'typescript'
  }
};
const parser = new PgProtoParser(inFile, options);

parser.write();
