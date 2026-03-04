import { QuoteUtils } from '../src/quote-utils';

describe('QuoteUtils.escape', () => {
  it('should wrap string in single quotes', () => {
    expect(QuoteUtils.escape('hello')).toBe("'hello'");
  });

  it('should escape embedded single quotes', () => {
    expect(QuoteUtils.escape("it's")).toBe("'it''s'");
  });

  it('should handle empty string', () => {
    expect(QuoteUtils.escape('')).toBe("''");
  });

  it('should handle multiple single quotes', () => {
    expect(QuoteUtils.escape("a'b'c")).toBe("'a''b''c'");
  });
});

describe('QuoteUtils.escapeEString', () => {
  it('should escape backslashes', () => {
    expect(QuoteUtils.escapeEString('a\\b')).toBe('a\\\\b');
  });

  it('should escape single quotes', () => {
    expect(QuoteUtils.escapeEString("it's")).toBe("it''s");
  });

  it('should escape both backslashes and single quotes', () => {
    expect(QuoteUtils.escapeEString("it's a\\path")).toBe("it''s a\\\\path");
  });
});

describe('QuoteUtils.needsEscapePrefix', () => {
  it('should return true for strings with backslashes', () => {
    expect(QuoteUtils.needsEscapePrefix('a\\b')).toBe(true);
  });

  it('should return false for strings without backslashes', () => {
    expect(QuoteUtils.needsEscapePrefix('hello')).toBe(false);
  });

  it('should return false for bytea-style hex literals', () => {
    expect(QuoteUtils.needsEscapePrefix('\\x48656c6c6f')).toBe(false);
  });

  it('should return true for backslash strings that are not bytea hex', () => {
    expect(QuoteUtils.needsEscapePrefix('\\n')).toBe(true);
    expect(QuoteUtils.needsEscapePrefix('path\\to\\file')).toBe(true);
  });
});

describe('QuoteUtils.formatEString', () => {
  it('should use E-prefix for strings with backslashes', () => {
    expect(QuoteUtils.formatEString('a\\b')).toBe("E'a\\\\b'");
  });

  it('should use regular escape for strings without backslashes', () => {
    expect(QuoteUtils.formatEString('hello')).toBe("'hello'");
  });

  it('should not use E-prefix for bytea hex literals', () => {
    expect(QuoteUtils.formatEString('\\x48656c6c6f')).toBe("'\\x48656c6c6f'");
  });
});

describe('QuoteUtils.quoteIdentifier', () => {
  it('should not quote simple lowercase identifiers', () => {
    expect(QuoteUtils.quoteIdentifier('my_table')).toBe('my_table');
    expect(QuoteUtils.quoteIdentifier('foo')).toBe('foo');
    expect(QuoteUtils.quoteIdentifier('_private')).toBe('_private');
  });

  it('should quote identifiers with uppercase', () => {
    expect(QuoteUtils.quoteIdentifier('MyTable')).toBe('"MyTable"');
  });

  it('should quote identifiers starting with digits', () => {
    expect(QuoteUtils.quoteIdentifier('1foo')).toBe('"1foo"');
  });

  it('should quote identifiers with special characters', () => {
    expect(QuoteUtils.quoteIdentifier('my-table')).toBe('"my-table"');
    expect(QuoteUtils.quoteIdentifier('my table')).toBe('"my table"');
  });

  it('should quote reserved keywords', () => {
    expect(QuoteUtils.quoteIdentifier('select')).toBe('"select"');
    expect(QuoteUtils.quoteIdentifier('from')).toBe('"from"');
    expect(QuoteUtils.quoteIdentifier('table')).toBe('"table"');
    expect(QuoteUtils.quoteIdentifier('where')).toBe('"where"');
  });

  it('should quote col_name keywords', () => {
    expect(QuoteUtils.quoteIdentifier('int')).toBe('"int"');
    expect(QuoteUtils.quoteIdentifier('json')).toBe('"json"');
    expect(QuoteUtils.quoteIdentifier('boolean')).toBe('"boolean"');
  });

  it('should quote type_func_name keywords', () => {
    expect(QuoteUtils.quoteIdentifier('authorization')).toBe('"authorization"');
    expect(QuoteUtils.quoteIdentifier('join')).toBe('"join"');
  });

  it('should not quote unreserved keywords', () => {
    expect(QuoteUtils.quoteIdentifier('abort')).toBe('abort');
    expect(QuoteUtils.quoteIdentifier('begin')).toBe('begin');
    expect(QuoteUtils.quoteIdentifier('schema')).toBe('schema');
  });

  it('should escape embedded double quotes', () => {
    expect(QuoteUtils.quoteIdentifier('a"b')).toBe('"a""b"');
  });

  it('should return falsy values as-is', () => {
    expect(QuoteUtils.quoteIdentifier('')).toBe('');
  });
});

describe('QuoteUtils.quoteIdentifierAfterDot', () => {
  it('should not quote simple lowercase identifiers', () => {
    expect(QuoteUtils.quoteIdentifierAfterDot('my_col')).toBe('my_col');
  });

  it('should quote identifiers with uppercase', () => {
    expect(QuoteUtils.quoteIdentifierAfterDot('MyCol')).toBe('"MyCol"');
  });

  it('should NOT quote keywords (all keywords allowed after dot)', () => {
    expect(QuoteUtils.quoteIdentifierAfterDot('select')).toBe('select');
    expect(QuoteUtils.quoteIdentifierAfterDot('from')).toBe('from');
    expect(QuoteUtils.quoteIdentifierAfterDot('table')).toBe('table');
  });

  it('should quote identifiers with special characters', () => {
    expect(QuoteUtils.quoteIdentifierAfterDot('my-col')).toBe('"my-col"');
  });

  it('should return falsy values as-is', () => {
    expect(QuoteUtils.quoteIdentifierAfterDot('')).toBe('');
  });
});

describe('QuoteUtils.quoteDottedName', () => {
  it('should handle single-part names', () => {
    expect(QuoteUtils.quoteDottedName(['my_table'])).toBe('my_table');
    expect(QuoteUtils.quoteDottedName(['select'])).toBe('"select"');
  });

  it('should handle two-part names', () => {
    expect(QuoteUtils.quoteDottedName(['public', 'my_table'])).toBe('public.my_table');
  });

  it('should use strict quoting for first part, relaxed for rest', () => {
    // "select" as first part should be quoted (reserved keyword)
    // "select" as second part should NOT be quoted (after dot)
    expect(QuoteUtils.quoteDottedName(['select', 'select'])).toBe('"select".select');
  });

  it('should handle three-part names', () => {
    expect(QuoteUtils.quoteDottedName(['catalog', 'public', 'my_table'])).toBe('catalog.public.my_table');
  });

  it('should return empty string for empty array', () => {
    expect(QuoteUtils.quoteDottedName([])).toBe('');
  });
});

describe('QuoteUtils.quoteQualifiedIdentifier', () => {
  it('should handle qualified identifiers', () => {
    expect(QuoteUtils.quoteQualifiedIdentifier('public', 'my_table')).toBe('public.my_table');
  });

  it('should handle null qualifier', () => {
    expect(QuoteUtils.quoteQualifiedIdentifier(null, 'my_table')).toBe('my_table');
  });

  it('should handle undefined qualifier', () => {
    expect(QuoteUtils.quoteQualifiedIdentifier(undefined, 'my_table')).toBe('my_table');
  });

  it('should quote qualifier keywords but not ident keywords after dot', () => {
    expect(QuoteUtils.quoteQualifiedIdentifier('select', 'from')).toBe('"select".from');
  });
});

describe('QuoteUtils.quoteIdentifierTypeName', () => {
  it('should not quote simple identifiers', () => {
    expect(QuoteUtils.quoteIdentifierTypeName('my_type')).toBe('my_type');
  });

  it('should not quote col_name keywords (allowed in type position)', () => {
    expect(QuoteUtils.quoteIdentifierTypeName('int')).toBe('int');
    expect(QuoteUtils.quoteIdentifierTypeName('json')).toBe('json');
    expect(QuoteUtils.quoteIdentifierTypeName('boolean')).toBe('boolean');
    expect(QuoteUtils.quoteIdentifierTypeName('varchar')).toBe('varchar');
    expect(QuoteUtils.quoteIdentifierTypeName('integer')).toBe('integer');
  });

  it('should not quote type_func_name keywords (allowed in type position)', () => {
    expect(QuoteUtils.quoteIdentifierTypeName('authorization')).toBe('authorization');
  });

  it('should not quote unreserved keywords', () => {
    expect(QuoteUtils.quoteIdentifierTypeName('abort')).toBe('abort');
  });

  it('should quote reserved keywords', () => {
    expect(QuoteUtils.quoteIdentifierTypeName('select')).toBe('"select"');
    expect(QuoteUtils.quoteIdentifierTypeName('table')).toBe('"table"');
  });

  it('should quote identifiers with uppercase', () => {
    expect(QuoteUtils.quoteIdentifierTypeName('MyType')).toBe('"MyType"');
  });

  it('should return falsy values as-is', () => {
    expect(QuoteUtils.quoteIdentifierTypeName('')).toBe('');
  });
});

describe('QuoteUtils.quoteTypeDottedName', () => {
  it('should handle single-part type names', () => {
    expect(QuoteUtils.quoteTypeDottedName(['integer'])).toBe('integer');
  });

  it('should handle schema-qualified type names', () => {
    expect(QuoteUtils.quoteTypeDottedName(['public', 'my_type'])).toBe('public.my_type');
  });

  it('should allow col_name keywords in all positions', () => {
    expect(QuoteUtils.quoteTypeDottedName(['json'])).toBe('json');
    expect(QuoteUtils.quoteTypeDottedName(['public', 'json'])).toBe('public.json');
  });

  it('should return empty string for empty array', () => {
    expect(QuoteUtils.quoteTypeDottedName([])).toBe('');
  });
});
