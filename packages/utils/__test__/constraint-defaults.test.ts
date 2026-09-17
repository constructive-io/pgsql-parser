import type { Constraint } from '@pgsql/types';
import { deparseSync as deparse } from 'pgsql-deparser';

import * as t from '../src';

describe('constraint builder defaults', () => {
  it('defaults CHECK and FOREIGN KEY constraints to enforced', () => {
    expect(t.ast.constraint({ contype: 'CONSTR_CHECK' }).is_enforced).toBe(true);
    expect(t.nodes.constraint({ contype: 'CONSTR_CHECK' }).Constraint.is_enforced).toBe(true);
    expect(t.ast.constraint({ contype: 'CONSTR_FOREIGN' }).is_enforced).toBe(true);
    expect(t.nodes.constraint({ contype: 'CONSTR_FOREIGN' }).Constraint.is_enforced).toBe(true);
  });

  it('preserves an explicit NOT ENFORCED value', () => {
    const check: Constraint = t.ast.constraint({
      contype: 'CONSTR_CHECK',
      is_enforced: false
    });
    const foreign: Constraint = t.nodes.constraint({
      contype: 'CONSTR_FOREIGN',
      is_enforced: false
    }).Constraint;

    expect(check.is_enforced).toBe(false);
    expect(foreign.is_enforced).toBe(false);
  });

  it('does not add is_enforced to other constraint types', () => {
    for (const contype of ['CONSTR_UNIQUE', 'CONSTR_PRIMARY', 'CONSTR_NOTNULL'] as const) {
      expect('is_enforced' in t.ast.constraint({ contype })).toBe(false);
      expect('is_enforced' in t.nodes.constraint({ contype }).Constraint).toBe(false);
    }
  });

  it('deparses enforced CHECK constraints without NOT ENFORCED', () => {
    const stmt = t.nodes.alterTableStmt({
      relation: t.ast.rangeVar({ relname: 't', inh: false }),
      cmds: [
        t.nodes.alterTableCmd({
          subtype: 'AT_AddConstraint',
          def: t.nodes.constraint({
            contype: 'CONSTR_CHECK',
            conname: 'x_positive',
            raw_expr: t.nodes.aExpr({
              kind: 'AEXPR_OP',
              name: [t.nodes.string({ sval: '>' })],
              lexpr: t.nodes.columnRef({
                fields: [t.nodes.string({ sval: 'x' })]
              }),
              rexpr: t.nodes.aConst({ ival: t.ast.integer({ ival: 0 }) })
            })
          })
        })
      ]
    });

    expect(deparse(stmt, { pretty: false })).toBe(
      'ALTER TABLE t ADD CONSTRAINT x_positive CHECK (x > 0)'
    );
  });

  it('deparses skip_validation as NOT VALID', () => {
    const stmt = t.nodes.alterTableStmt({
      relation: t.ast.rangeVar({ relname: 't', inh: false }),
      cmds: [
        t.nodes.alterTableCmd({
          subtype: 'AT_AddConstraint',
          def: t.nodes.constraint({
            contype: 'CONSTR_CHECK',
            conname: 'x_positive',
            skip_validation: true,
            raw_expr: t.nodes.aExpr({
              kind: 'AEXPR_OP',
              name: [t.nodes.string({ sval: '>' })],
              lexpr: t.nodes.columnRef({
                fields: [t.nodes.string({ sval: 'x' })]
              }),
              rexpr: t.nodes.aConst({ ival: t.ast.integer({ ival: 0 }) })
            })
          })
        })
      ]
    });

    expect(deparse(stmt, { pretty: false })).toContain('CHECK (x > 0) NOT VALID');
  });
});
