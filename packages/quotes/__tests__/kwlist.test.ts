import {
  keywordKindOf,
  kwlist,
  RESERVED_KEYWORDS,
  UNRESERVED_KEYWORDS,
  COL_NAME_KEYWORDS,
  TYPE_FUNC_NAME_KEYWORDS,
} from '../src/kwlist';

describe('kwlist', () => {
  it('should have all four keyword categories', () => {
    expect(kwlist.UNRESERVED_KEYWORD.length).toBeGreaterThan(0);
    expect(kwlist.RESERVED_KEYWORD.length).toBeGreaterThan(0);
    expect(kwlist.TYPE_FUNC_NAME_KEYWORD.length).toBeGreaterThan(0);
    expect(kwlist.COL_NAME_KEYWORD.length).toBeGreaterThan(0);
  });

  it('should have pre-built Sets matching arrays', () => {
    expect(RESERVED_KEYWORDS.size).toBe(kwlist.RESERVED_KEYWORD.length);
    expect(UNRESERVED_KEYWORDS.size).toBe(kwlist.UNRESERVED_KEYWORD.length);
    expect(COL_NAME_KEYWORDS.size).toBe(kwlist.COL_NAME_KEYWORD.length);
    expect(TYPE_FUNC_NAME_KEYWORDS.size).toBe(kwlist.TYPE_FUNC_NAME_KEYWORD.length);
  });
});

describe('keywordKindOf', () => {
  it('should classify reserved keywords', () => {
    expect(keywordKindOf('select')).toBe('RESERVED_KEYWORD');
    expect(keywordKindOf('from')).toBe('RESERVED_KEYWORD');
    expect(keywordKindOf('where')).toBe('RESERVED_KEYWORD');
    expect(keywordKindOf('table')).toBe('RESERVED_KEYWORD');
    expect(keywordKindOf('create')).toBe('RESERVED_KEYWORD');
  });

  it('should classify unreserved keywords', () => {
    expect(keywordKindOf('abort')).toBe('UNRESERVED_KEYWORD');
    expect(keywordKindOf('begin')).toBe('UNRESERVED_KEYWORD');
    expect(keywordKindOf('commit')).toBe('UNRESERVED_KEYWORD');
    expect(keywordKindOf('schema')).toBe('UNRESERVED_KEYWORD');
    expect(keywordKindOf('index')).toBe('UNRESERVED_KEYWORD');
  });

  it('should classify col_name keywords', () => {
    expect(keywordKindOf('int')).toBe('COL_NAME_KEYWORD');
    expect(keywordKindOf('integer')).toBe('COL_NAME_KEYWORD');
    expect(keywordKindOf('boolean')).toBe('COL_NAME_KEYWORD');
    expect(keywordKindOf('json')).toBe('COL_NAME_KEYWORD');
    expect(keywordKindOf('varchar')).toBe('COL_NAME_KEYWORD');
  });

  it('should classify type_func_name keywords', () => {
    expect(keywordKindOf('authorization')).toBe('TYPE_FUNC_NAME_KEYWORD');
    expect(keywordKindOf('cross')).toBe('TYPE_FUNC_NAME_KEYWORD');
    expect(keywordKindOf('join')).toBe('TYPE_FUNC_NAME_KEYWORD');
    expect(keywordKindOf('left')).toBe('TYPE_FUNC_NAME_KEYWORD');
  });

  it('should return NO_KEYWORD for non-keywords', () => {
    expect(keywordKindOf('my_table')).toBe('NO_KEYWORD');
    expect(keywordKindOf('foo')).toBe('NO_KEYWORD');
    expect(keywordKindOf('bar_baz')).toBe('NO_KEYWORD');
  });

  it('should be case-insensitive', () => {
    expect(keywordKindOf('SELECT')).toBe('RESERVED_KEYWORD');
    expect(keywordKindOf('Select')).toBe('RESERVED_KEYWORD');
    expect(keywordKindOf('BEGIN')).toBe('UNRESERVED_KEYWORD');
  });
});
