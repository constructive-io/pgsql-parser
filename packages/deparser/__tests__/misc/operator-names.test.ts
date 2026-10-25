import { Deparser } from '../../src';

// The parser can only produce operator names that lex back as one operator token,
// so names that would not round-trip have to be hand-built.
const opExpr = (...name: string[]) => ({
  A_Expr: {
    kind: 'AEXPR_OP',
    name: name.map(sval => ({ String: { sval } })),
    lexpr: { ColumnRef: { fields: [{ String: { sval: 'a' } }] } },
    rexpr: { ColumnRef: { fields: [{ String: { sval: 'b' } }] } }
  }
});

describe('operator names', () => {
  it.each([
    ['+-'],
    ['*-'],
    ['--'],
    ['/*'],
    ['!='],
    ['=>'],
    ['and'],
    [''],
    ['<'.repeat(64)]
  ])('rejects %j, which would not reparse as the same operator', op => {
    expect(() => Deparser.deparse(opExpr(op) as any)).toThrow(/Invalid operator name/);
    expect(() => Deparser.deparse(opExpr('s', op) as any)).toThrow(/Invalid operator name/);
  });

  it.each([
    [['+'], 'a + b'],
    [['@-@'], 'a @-@ b'],
    [['~-'], 'a ~- b'],
    [['My Schema', '<->'], 'a OPERATOR("My Schema".<->) b']
  ])('keeps %j', (name, expected) => {
    expect(Deparser.deparse(opExpr(...name) as any)).toBe(expected);
  });
});
