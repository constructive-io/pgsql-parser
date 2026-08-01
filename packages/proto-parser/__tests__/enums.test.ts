import { parseAndSnap } from '../test-utils';

describe('pure', () => {
  it('enums', () => {
    parseAndSnap('enums/pure/noRemoveUndef', {
      enums: {
        enabled: true,
        enumsAsTypeUnion: false,
        removeUndefinedAt0: false
      }
    });
  });

  it('removeAt0', () => {
    parseAndSnap('enums/pure/removeUndef', {
      enums: {
        enabled: true,
        enumsAsTypeUnion: false,
        removeUndefinedAt0: true
      }
    });
  });
});

describe('typeUnion', () => {
  it('enums', () => {
    parseAndSnap('enums/typeUnion/noRemoveUndef', {
      enums: {
        enabled: true,
        enumsAsTypeUnion: true,
        removeUndefinedAt0: false
      }
    });
  });
  it('removeAt0', () => {
    parseAndSnap('enums/typeUnion/removeUndef', {
      enums: {
        enabled: true,
        enumsAsTypeUnion: true,
        removeUndefinedAt0: true
      }
    });
  });
});


