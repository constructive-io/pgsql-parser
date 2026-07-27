import {
  CLEAN_TREE_VOLATILE_KEYS,
  cleanTree,
  firstDifference,
  normalizeTree,
  trimDefElemBody,
} from '../src/round-trip-core';

describe('normalizeTree', () => {
  it('drops volatile keys recursively', () => {
    const tree = {
      A: { sval: 'x', location: 5, inner: { location: 9, keep: 1 } },
      list: [{ location: 1, v: 2 }],
    };
    const out = normalizeTree(tree, { volatileKeys: new Set(['location']) });
    expect(out).toEqual({
      A: { sval: 'x', inner: { keep: 1 } },
      list: [{ v: 2 }],
    });
  });

  it('sorts object keys when sortKeys is set', () => {
    const out = normalizeTree({ b: 1, a: 2, c: 3 }, { sortKeys: true });
    expect(Object.keys(out)).toEqual(['a', 'b', 'c']);
  });

  it('preserves key order by default', () => {
    const out = normalizeTree({ b: 1, a: 2 });
    expect(Object.keys(out)).toEqual(['b', 'a']);
  });

  it('filters array items via dropArrayItem', () => {
    const out = normalizeTree([{ drop: true }, { keep: 1 }, { drop: true }], {
      dropArrayItem: (i: any) => i?.drop === true,
    });
    expect(out).toEqual([{ keep: 1 }]);
  });

  it('applies per-key handlers with a recurse callback', () => {
    const out = normalizeTree(
      { Wrap: { location: 1, sval: ' body ' } },
      {
        volatileKeys: new Set(['location']),
        keyHandlers: {
          Wrap: (v: any, recurse) => ({ ...recurse(v), tag: 'seen' }),
        },
      }
    );
    expect(out).toEqual({ Wrap: { sval: ' body ', tag: 'seen' } });
  });

  it('returns primitives untouched and clones Dates', () => {
    expect(normalizeTree(42)).toBe(42);
    expect(normalizeTree('s')).toBe('s');
    expect(normalizeTree(null)).toBe(null);
    const d = new Date(1234567890);
    const out = normalizeTree(d);
    expect(out).toEqual(d);
    expect(out).not.toBe(d);
  });
});

describe('firstDifference', () => {
  it('returns null for deeply equal trees', () => {
    expect(firstDifference({ a: [1, 2] }, { a: [1, 2] })).toBeNull();
  });

  it('reports the path of a scalar difference', () => {
    expect(firstDifference({ a: { b: 1 } }, { a: { b: 2 } })).toBe(
      '$.a.b (1 vs 2)'
    );
  });

  it('reports array length differences', () => {
    expect(firstDifference([1], [1, 2])).toBe('$ (array length 1 vs 2)');
  });
});

describe('cleanTree preset (upstream-compatible)', () => {
  it('exposes the upstream volatile key set', () => {
    expect([...CLEAN_TREE_VOLATILE_KEYS].sort()).toEqual([
      'list_end',
      'list_start',
      'location',
      'rexpr_list_end',
      'rexpr_list_start',
      'stmt_len',
      'stmt_location',
    ]);
  });

  it('strips stmt_len / stmt_location / location', () => {
    const tree = {
      stmts: [
        {
          stmt_len: 10,
          stmt_location: 0,
          stmt: { SelectStmt: { location: 7, op: 'SETOP_NONE' } },
        },
      ],
    };
    expect(cleanTree(tree)).toEqual({
      stmts: [{ stmt: { SelectStmt: { op: 'SETOP_NONE' } } }],
    });
  });

  it('trims DefElem "as" body for the array-arg (function) shape', () => {
    const tree = {
      DefElem: { defname: 'as', arg: [{ String: { sval: '  body \n' } }] },
    };
    expect(cleanTree(tree)).toEqual({
      DefElem: { defname: 'as', arg: [{ String: { sval: 'body' } }] },
    });
  });

  it('trims DefElem "as" body for the List.items shape', () => {
    const tree = {
      DefElem: {
        defname: 'as',
        arg: { List: { items: [{ String: { sval: ' x ' } }] } },
      },
    };
    expect((cleanTree(tree) as any).DefElem.arg.List.items[0].String.sval).toBe(
      'x'
    );
  });

  it('trims DefElem "as" body for the plain String (DO block) shape', () => {
    const tree = { DefElem: { defname: 'as', arg: { String: { sval: ' do ' } } } };
    expect((cleanTree(tree) as any).DefElem.arg.String.sval).toBe('do');
  });

  it('leaves non-"as" DefElem bodies untouched', () => {
    const tree = { DefElem: { defname: 'volatile', arg: { String: { sval: ' keep ' } } } };
    expect((cleanTree(tree) as any).DefElem.arg.String.sval).toBe(' keep ');
  });
});

describe('trimDefElemBody', () => {
  it('is a no-op for non-"as" defnames', () => {
    const d = { defname: 'strict', arg: { String: { sval: ' x ' } } };
    trimDefElemBody(d);
    expect(d.arg.String.sval).toBe(' x ');
  });
});
