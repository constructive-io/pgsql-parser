import deepmerge from 'deepmerge';
import { join } from 'path';

import { PgProtoParserOptions } from './types';

// Define default options outside of the class
export const defaultPgProtoParserOptions: PgProtoParserOptions = {
  outDir: join(process.cwd(), 'out'),
  includeHeader: true,
  exclude: [],
  utils: {
    enums: {
      enabled: false,
      filename: 'utils.ts',
      unidirectional: false,
      toIntFilename: 'enum-to-int.ts',
      toStringFilename: 'enum-to-string.ts',
      outputFormat: 'switchStatements'
    },
    astHelpers: {
      enabled: false,
      typesSource: './types',
      inlineNestedObj: false,
      nestedObjFile: 'nested-obj.ts',
      filename: 'asts.ts',
    },
    wrappedAstHelpers: {
      enabled: false,
      filename: 'wrapped-asts.ts'
    }
  },
  types: {
    enabled: false,
    filename: 'types.ts',
    optionalFields: true,
    enumsSource: './enums',
    wrappedNodeTypeExport: true
  },
  enums: {
    enabled: false,
    filename: 'enums.ts',
    enumsAsTypeUnion: true,

    enumMap: {
      enabled: false,
      format: 'ts',
      toIntOutFile: 'enums2int.ts',
      toStrOutFile: 'enums2str.ts'
    },
    removeUndefinedAt0: true
  },
  runtimeSchema: {
    enabled: false,
    filename: 'runtime-schema',
    format: 'json'
  },
  parser: {
    keepCase: false,
    alternateCommentMode: true,
    preferTrailingComment: false
  }
};

export const getOptionsWithDefaults = (options: PgProtoParserOptions): PgProtoParserOptions => {
  // If an element at the same key is present for both x and y in deepmerge(x,y), the value from y will appear in the result.
  options = deepmerge(defaultPgProtoParserOptions, options ?? {});
  return options;
};
