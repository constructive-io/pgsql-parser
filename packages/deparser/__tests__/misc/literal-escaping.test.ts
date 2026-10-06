import { parse } from 'libpg-query';

import { Deparser } from '../../src';
import { expectParseDeparse } from '../../test-utils';

const SENTINEL = 'sentinel_value';
const payload = "x' OR '1'='1; DROP TABLE t; --";

const replaceStrings = (node: any, from: string, to: string): any => {
  if (Array.isArray(node)) return node.map(item => replaceStrings(item, from, to));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, replaceStrings(v, from, to)]));
  }
  return node === from ? to : node;
};

const containsString = (node: any, value: string): boolean => {
  if (Array.isArray(node)) return node.some(item => containsString(item, value));
  if (node && typeof node === 'object') return Object.values(node).some(v => containsString(v, value));
  return node === value;
};

// Build an AST from benign SQL, swap the sentinel for a quote-carrying payload,
// and check the deparsed SQL keeps the payload inside a single literal.
const expectPayloadStaysLiteral = async (sql: string) => {
  const ast = replaceStrings(await parse(sql), SENTINEL, payload);
  const deparsed = Deparser.deparse(ast);
  const reparsed = await parse(deparsed);
  expect(reparsed.stmts).toHaveLength(1);
  expect(containsString(reparsed, payload)).toBe(true);
  return deparsed;
};

describe('string literal escaping in hand-built ASTs', () => {
  it.each([
    `PREPARE TRANSACTION '${SENTINEL}'`,
    `COMMIT PREPARED '${SENTINEL}'`,
    `ROLLBACK PREPARED '${SENTINEL}'`,
    `NOTIFY ch, '${SENTINEL}'`,
    `LOAD '${SENTINEL}'`,
    `CREATE TABLESPACE ts LOCATION '${SENTINEL}'`,
    `SECURITY LABEL ON TABLE t IS '${SENTINEL}'`,
    `CREATE SUBSCRIPTION s CONNECTION '${SENTINEL}' PUBLICATION p`,
    `CREATE CONVERSION c FOR '${SENTINEL}' TO 'UTF8' FROM f`,
    `CREATE CONVERSION c FOR 'LATIN1' TO '${SENTINEL}' FROM f`,
    `SET search_path = '${SENTINEL}'`,
    `CREATE INDEX i ON t USING gist (c opc (opt = '${SENTINEL}'))`,
    `CREATE INDEX i ON t (c) WITH (opt = '${SENTINEL}')`,
    `CREATE TABLE t (a int) WITH (opt = '${SENTINEL}')`,
    `ALTER TABLE t SET (opt = '${SENTINEL}')`,
    `CREATE FOREIGN DATA WRAPPER w OPTIONS (opt '${SENTINEL}')`,
    `ALTER FOREIGN DATA WRAPPER w OPTIONS (ADD opt '${SENTINEL}')`,
    `CREATE SERVER s FOREIGN DATA WRAPPER w OPTIONS (host '${SENTINEL}')`,
    `CREATE USER MAPPING FOR u SERVER s OPTIONS (password '${SENTINEL}')`,
    `CREATE FOREIGN TABLE ft (a int OPTIONS (col '${SENTINEL}')) SERVER s`,
    `CREATE ROLE r PASSWORD '${SENTINEL}'`,
    `CREATE ROLE r VALID UNTIL '${SENTINEL}'`,
    `ALTER EXTENSION e UPDATE TO '${SENTINEL}'`,
    `CREATE EVENT TRIGGER e ON ddl_command_start WHEN TAG IN ('${SENTINEL}') EXECUTE FUNCTION f()`,
    `CREATE TYPE ty (input = i, output = o, category = '${SENTINEL}')`,
    `CREATE TYPE ty (input = i, output = o, "Category" = '${SENTINEL}')`,
    `CREATE AGGREGATE agg (int) (sfunc = f, stype = int, initcond = '${SENTINEL}')`,
    `CREATE COLLATION c (locale = '${SENTINEL}')`,
    `SELECT * FROM XMLTABLE('${SENTINEL}' PASSING doc COLUMNS a int PATH 'a')`,
    `SELECT * FROM XMLTABLE('/r' PASSING doc COLUMNS a int PATH '${SENTINEL}')`
  ])('%s', async (sql) => {
    await expectPayloadStaysLiteral(sql);
  });
});

describe('numeric literals in hand-built ASTs', () => {
  const selectConst = (aConst: any) => ({
    SelectStmt: {
      targetList: [{ ResTarget: { val: { A_Const: aConst } } }],
      limitOption: 'LIMIT_OPTION_DEFAULT',
      op: 'SETOP_NONE'
    }
  });

  it.each([
    ['1.5', '1.5'],
    ['-2.5e-3', '-2.5e-3'],
    ['.5', '.5'],
    ['1_000.000_1', '1_000.000_1'],
    ['0x7FFFFFFFFFFFFFFF', '0x7FFFFFFFFFFFFFFF'],
    ['0x_FFFF_FFFF_FFFF_FFFF', '0x_FFFF_FFFF_FFFF_FFFF'],
    ['1_000.5e1_0', '1_000.5e1_0']
  ])('emits valid fval %s', (fval, expected) => {
    expect(Deparser.deparse(selectConst({ fval: { fval } }) as any)).toBe(`SELECT ${expected}`);
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

describe('XMLTABLE', () => {
  it.each([
    `SELECT * FROM XMLTABLE('/r' PASSING doc COLUMNS a int PATH 'a', b text PATH 'b''c' DEFAULT 'd' NOT NULL, n FOR ORDINALITY)`,
    `SELECT * FROM XMLTABLE(XMLNAMESPACES('http://x' AS x, DEFAULT 'http://d'), '/x:r' PASSING (SELECT doc FROM t) COLUMNS a int) AS xt`,
    `SELECT * FROM t, LATERAL XMLTABLE('/r' PASSING t.doc COLUMNS a int PATH 'a') xt`
  ])('round-trips %s', async (sql) => {
    await expectParseDeparse(sql);
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
