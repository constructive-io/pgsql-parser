import { cleanPlpgsqlTree } from '../test-utils';

describe('cleanPlpgsqlTree type references', () => {
  it.each(['TYPE', 'ROWTYPE'])('normalizes the %s suffix casing', (suffix) => {
    expect(cleanPlpgsqlTree({ typname: `"MixedCase"%${suffix}` })).toEqual({
      typname: `"MixedCase"%${suffix.toLowerCase()}`,
    });
  });

  it.each(['', 'integer', '"MixedCase"', '"quoted%TYPE"'])('preserves %j', (typname) => {
    expect(cleanPlpgsqlTree({ typname })).toEqual({ typname });
  });
});
