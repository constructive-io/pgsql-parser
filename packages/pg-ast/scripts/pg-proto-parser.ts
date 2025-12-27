import { PgProtoParser, PgProtoParserOptions } from 'pg-proto-parser';
import { resolve, join } from 'path';

const inFile: string = join(__dirname, '../../../__fixtures__/proto/17-latest.proto');
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
    enabled: false
  }
};
const parser = new PgProtoParser(inFile, options);

parser.write();
