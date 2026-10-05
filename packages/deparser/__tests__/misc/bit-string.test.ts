import { Deparser } from '../../src';
import { expectParseDeparse } from '../../test-utils';

const payload = "x' OR '1'='1";

const selectConst = (aConst: any) => ({
  SelectStmt: {
    targetList: [{ ResTarget: { val: { A_Const: aConst } } }],
    limitOption: 'LIMIT_OPTION_DEFAULT',
    op: 'SETOP_NONE'
  }
});

describe('bit-string literals', () => {
  it('round-trips binary and hex bit strings', async () => {
    await expectParseDeparse(`SELECT B'1010', X'1F'`);
  });

  it.each([
    ['b-prefixed', { bsval: { bsval: `b${payload}` } }, `SELECT b'x'' OR ''1''=''1'`],
    ['x-prefixed', { bsval: { bsval: `x1F' OR '1'='1` } }, `SELECT b'x1F'' OR ''1''=''1'`],
    ['unprefixed', { bsval: { bsval: `1' OR '1'='1` } }, `SELECT b'1'' OR ''1''=''1'`],
    ['unwrapped', { bsval: `b${payload}` }, `SELECT b'x'' OR ''1''=''1'`],
    ['val.BitString', { val: { BitString: { bsval: `b${payload}` } } }, `SELECT b'x'' OR ''1''=''1'`]
  ])('escapes single quotes in %s A_Const bsval', (_label, aConst, expected) => {
    expect(Deparser.deparse(selectConst(aConst) as any)).toBe(expected);
  });

  it('escapes single quotes in BitString nodes', () => {
    const deparser = new Deparser([]);
    expect(deparser.BitString({ bsval: `b${payload}` }, {} as any)).toBe(`b'x'' OR ''1''=''1'`);
  });
});
