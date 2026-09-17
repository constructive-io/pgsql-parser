import type { Constraint } from '@pgsql/types';

import ast from './asts';
import nodes from './wrapped';

const astWithConstraint = {
  ...ast,
  constraint(_p?: Constraint): Constraint {
    const constraint = ast.constraint(_p);
    if (
      (_p?.contype === 'CONSTR_CHECK' || _p?.contype === 'CONSTR_FOREIGN') &&
      _p?.is_enforced === undefined
    ) {
      constraint.is_enforced = true;
    }
    return constraint;
  }
};

const nodesWithConstraint = {
  ...nodes,
  constraint(_p?: Constraint): { Constraint: Constraint } {
    const constraint = nodes.constraint(_p);
    if (
      (_p?.contype === 'CONSTR_CHECK' || _p?.contype === 'CONSTR_FOREIGN') &&
      _p?.is_enforced === undefined
    ) {
      constraint.Constraint.is_enforced = true;
    }
    return constraint;
  }
};

export { nodesWithConstraint as nodes };
export { astWithConstraint as ast };
export default {
  nodes: nodesWithConstraint,
  ast: astWithConstraint
};