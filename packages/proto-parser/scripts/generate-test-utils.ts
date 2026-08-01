import { join,resolve } from 'path';

import { PgProtoParser, PgProtoParserOptions } from '../src';
import { getTestProtoPath } from '../test-utils';

const inFile: string = getTestProtoPath('13-latest.proto');
const outDir: string = resolve(join(__dirname, '../test-utils/utils'));

const options: PgProtoParserOptions = {
  outDir,
  types: {
    enabled: false,
    wrapped: {
      enabled: true,
      enumsSource: '@pgsql/types',
    }
  },
  utils: {
    astHelpers: {
      enabled: true,
      typesSource: './types'
    }
  }
};
const parser = new PgProtoParser(inFile, options);

parser.write();
