import { Deparser } from '../../src';
import { expectParseDeparse } from '../../test-utils';

// An access method is a name. Parsed SQL only ever yields a plain identifier
// there, so the hostile values live in hand-built ASTs, not a fixture.

const smuggled = 'btree (a); DROP TABLE t; --';
const quoted = `USING "${smuggled}"`;

const relation = { relname: 't', inh: true, relpersistence: 'p' };
const indexParams = [{ IndexElem: { name: 'a', ordering: 'SORTBY_DEFAULT', nulls_ordering: 'SORTBY_NULLS_DEFAULT' } }];

describe('access method names in hand-built ASTs', () => {
  it.each<[string, any]>([
    ['IndexStmt', { IndexStmt: { idxname: 'i', relation, accessMethod: smuggled, indexParams } }],
    ['CreateStmt', { CreateStmt: { relation, accessMethod: smuggled, oncommit: 'ONCOMMIT_NOOP' } }],
    [
      'exclusion Constraint',
      {
        AlterTableStmt: {
          relation,
          objtype: 'OBJECT_TABLE',
          cmds: [{
            AlterTableCmd: {
              subtype: 'AT_AddConstraint',
              behavior: 'DROP_RESTRICT',
              def: {
                Constraint: {
                  contype: 'CONSTR_EXCLUSION',
                  conname: 'c',
                  access_method: smuggled,
                  exclusions: [{ List: { items: [indexParams[0], { List: { items: [{ String: { sval: '=' } }] } }] } }]
                }
              }
            }
          }]
        }
      }
    ]
  ])('quotes a %s access method that is not a plain identifier', (_label, node) => {
    const sql = Deparser.deparse(node);
    expect(sql).toContain(quoted);
    expect(sql.replace(quoted, '')).not.toContain(';');
  });

  it.each([
    'CREATE INDEX i ON t USING gin (a)',
    'CREATE INDEX i ON t USING hnsw (a vector_cosine_ops)',
    'CREATE INDEX i ON t USING ivfflat (a vector_cosine_ops) WITH (lists = 100)',
    'CREATE INDEX i ON t USING bm25 (a) WITH (k1 = 1.2)',
    'CREATE INDEX i ON t USING "Odd Name" (a)',
    'ALTER TABLE t ADD CONSTRAINT c EXCLUDE USING gist (a WITH =)',
    'CREATE TABLE t (a int) USING heap',
    'ALTER OPERATOR FAMILY f USING btree RENAME TO g',
    'ALTER OPERATOR FAMILY f USING "Odd Name" RENAME TO g',
    'DROP OPERATOR CLASS c USING "Odd Name"',
    'COMMENT ON OPERATOR CLASS c USING "Odd Name" IS \'x\'',
    'COMMENT ON OPERATOR FAMILY s.f USING "Odd Name" IS \'x\''
  ])('round-trips %s', async (sql) => {
    await expectParseDeparse(sql);
  });
});
