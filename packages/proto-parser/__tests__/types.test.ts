import { parseAndSnap } from '../test-utils';

describe('types', () => {
  it('optionalFields', () => {
    parseAndSnap('types/optionalFields', {
      types: {
        enabled: true,
        optionalFields: true
      }
    });
  });
  it('fieldsRequired', () => {
    parseAndSnap('types/fieldsRequired', {
      types: {
        enabled: true,
        optionalFields: false
      }
    });
  });

  it('wrappedNodeTypeExport', () => {
    parseAndSnap('types/node-wrapped', {
      types: {
        enabled: true,
        enumsSource: 'my-enums.ts',
        filename: 'types.ts',
        wrappedNodeTypeExport: true
      }
    });
  });
});
