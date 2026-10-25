import { Deparser } from '../../src';

// The parser only emits Boolean(true) COPY option args (e.g. `CSV HEADER`), and the
// JSON AST omits `boolval` when it is false, so a false Boolean must be hand-built.
const copyWith = (defname: string, arg: any) => ({
  CopyStmt: {
    relation: { relname: 't', inh: true, relpersistence: 'p' },
    is_from: true,
    options: [{ DefElem: { defname, arg, defaction: 'DEFELEM_UNSPEC' } }]
  }
});

describe('COPY Boolean option args', () => {
  it.each([
    ['false (boolval omitted)', { Boolean: {} }, 'COPY t FROM STDIN WITH (HEADER false)'],
    ['false', { Boolean: { boolval: false } }, 'COPY t FROM STDIN WITH (HEADER false)'],
    ['true', { Boolean: { boolval: true } }, 'COPY t FROM STDIN WITH (HEADER)']
  ])('keeps a %s Boolean value', (_label, arg, expected) => {
    expect(Deparser.deparse(copyWith('header', arg) as any)).toBe(expected);
  });
});
