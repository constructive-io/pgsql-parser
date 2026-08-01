import base from '@constructive-io/eslint-config';

export default [
  ...base,
  {
    ignores: [
      // fixtures and their expected codegen output
      '__fixtures__/**',
      '**/__snapshots__/**',
      // protobuf codegen (build:proto)
      'packages/utils/src/asts.ts',
      'packages/utils/src/runtime-schema.ts',
      'packages/utils/src/wrapped.ts',
      'packages/traverse/src/18/**',
      'packages/transform-ast/src/{13,14,15,16,17,18}/**',
      'packages/proto-parser/test-utils/**',
      // inferred/generated types and keyword list
      'packages/pgsql-types/src/types.ts',
      'packages/quotes/src/kwlist.ts',
      // generated kitchen-sink test files
      '**/__tests__/kitchen-sink/**'
    ]
  }
];
