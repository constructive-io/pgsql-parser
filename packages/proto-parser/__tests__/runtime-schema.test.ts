import { getStore, parseAndSnap } from '../test-utils';

describe('runtime-schema', () => {
  it('uses explicit JSON field names rather than protobufjs camelCase names', () => {
    const schema = getStore({}).getRuntimeSchema();
    const jsonObjectAgg = schema.find(node => node.name === 'JsonObjectAgg');

    expect(jsonObjectAgg.fields).toMatchObject([
      { name: 'absent_on_null' },
      { name: 'arg' },
      { name: 'constructor' },
      { name: 'unique' },
    ]);
  });

  it('json format enabled', () => {
    parseAndSnap('runtime-schema/json/enabled', {
      runtimeSchema: {
        enabled: true,
        format: 'json',
        filename: 'runtime-schema'
      }
    });
  });

  it('typescript format enabled', () => {
    parseAndSnap('runtime-schema/typescript/enabled', {
      runtimeSchema: {
        enabled: true,
        format: 'typescript',
        filename: 'runtime-schema'
      }
    });
  });

  it('custom filename json', () => {
    parseAndSnap('runtime-schema/json/custom-filename', {
      runtimeSchema: {
        enabled: true,
        format: 'json',
        filename: 'custom-node-specs'
      }
    });
  });

  it('custom filename typescript', () => {
    parseAndSnap('runtime-schema/typescript/custom-filename', {
      runtimeSchema: {
        enabled: true,
        format: 'typescript',
        filename: 'custom-node-specs'
      }
    });
  });

  it('disabled runtime schema', () => {
    parseAndSnap('runtime-schema/disabled', {
      runtimeSchema: {
        enabled: false
      },
      types: {
        enabled: true
      }
    });
  });

  it('runtime schema with all features enabled', () => {
    parseAndSnap('runtime-schema/full-features', {
      runtimeSchema: {
        enabled: true,
        format: 'json',
        filename: 'complete-schema'
      },
      types: {
        enabled: true
      },
      enums: {
        enabled: true
      },
      utils: {
        astHelpers: {
          enabled: true
        }
      }
    });
  });

  it('runtime schema with typescript and all features', () => {
    parseAndSnap('runtime-schema/typescript/full-features', {
      runtimeSchema: {
        enabled: true,
        format: 'typescript',
        filename: 'complete-schema'
      },
      types: {
        enabled: true
      },
      enums: {
        enabled: true
      },
      utils: {
        astHelpers: {
          enabled: true
        }
      }
    });
  });

  it('runtime schema with latest proto', () => {
    parseAndSnap('runtime-schema/latest-proto', {
      runtimeSchema: {
        enabled: true,
        format: 'json',
        filename: 'latest-schema'
      }
    }, '17-latest.proto');
  });
});
