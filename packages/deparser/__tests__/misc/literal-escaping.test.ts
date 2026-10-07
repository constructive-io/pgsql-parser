import { Deparser } from '../../src';

// Values that parsed SQL can never produce, so they can't live in a
// kitchen-sink fixture (see __fixtures__/kitchen-sink/misc/literal-escaping.sql).

describe('numeric literals in hand-built ASTs', () => {
  const selectConst = (aConst: any) => ({
    SelectStmt: {
      targetList: [{ ResTarget: { val: { A_Const: aConst } } }],
      limitOption: 'LIMIT_OPTION_DEFAULT',
      op: 'SETOP_NONE'
    }
  });

  it.each([
    ['wrapped fval', { fval: { fval: '1; DROP TABLE t' } }],
    ['unwrapped fval', { fval: '1 OR 1=1' }],
    ['val.Float', { val: { Float: { fval: '1)--' } } }],
    ['wrapped ival', { ival: { ival: '1; DROP TABLE t' } }],
    ['unwrapped ival', { ival: '1 OR 1=1' }],
    ['val.Integer', { val: { Integer: { ival: '1)--' } } }],
    ['doubled underscore', { fval: { fval: '1__0.5' } }],
    ['trailing underscore', { fval: { fval: '1_.5' } }],
    ['trailing hex underscore', { fval: { fval: '0xFF_' } }]
  ])('rejects non-numeric %s', (_label, aConst) => {
    expect(() => Deparser.deparse(selectConst(aConst) as any)).toThrow(/Invalid (numeric|integer) literal/);
  });

  it('rejects non-numeric Float and Integer nodes', () => {
    const deparser = new Deparser([]);
    expect(() => deparser.Float({ fval: '1; DROP TABLE t' }, {} as any)).toThrow(/Invalid numeric literal/);
    expect(() => deparser.Integer({ ival: '1; DROP TABLE t' as any }, {} as any)).toThrow(/Invalid integer literal/);
  });
});

describe('TableFunc (JSON_TABLE)', () => {
  it('does not re-quote the row path', () => {
    const deparser = new Deparser([]);
    const sql = deparser.TableFunc({
      functype: 'TFT_JSON_TABLE',
      docexpr: { ColumnRef: { fields: [{ String: { sval: 'doc' } }] } },
      rowexpr: { A_Const: { sval: { sval: "$.a' OR '1'='1" } } }
    } as any, {} as any);
    expect(sql).toBe("JSON_TABLE (doc) , '$.a'' OR ''1''=''1'");
  });
});
