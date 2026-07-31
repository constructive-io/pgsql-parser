/**
 * PL/pgSQL AST Traversal
 *
 * Provides a visitor pattern for traversing PL/pgSQL ASTs, sharing the node-path
 * shape of the SQL walker in this package. A PL/pgSQL body is a skeleton of
 * control flow whose leaves are SQL expressions, so hydrated expressions are
 * handed to `walkSqlAst` — this is the bridge between the two node universes.
 *
 * Only PL/pgSQL *types* are needed here (from `plpgsql-deparser`), never the
 * parser, which keeps this package free of the WASM parser dependency.
 */

import type { NodePath as SqlNodePath,Visitor as SqlVisitor, Walker as SqlWalker } from './traverse';
import { walkSqlAst } from './traverse';
import type {
  PLpgSQLParseResult,
  PLpgSQLFunctionNode,
  PLpgSQL_function,
  PLpgSQLDatum,
  PLpgSQLStmtNode,
  PLpgSQLExprNode,
  PLpgSQLTypeNode,
  PLpgSQL_stmt_block,
  PLpgSQL_stmt_if,
  PLpgSQL_stmt_case,
  PLpgSQL_stmt_loop,
  PLpgSQL_stmt_while,
  PLpgSQL_stmt_fori,
  PLpgSQL_stmt_fors,
  PLpgSQL_stmt_forc,
  PLpgSQL_stmt_foreach_a,
  PLpgSQL_stmt_return_query,
  PLpgSQL_stmt_raise,
  PLpgSQL_stmt_dynexecute,
  PLpgSQL_stmt_dynfors,
  PLpgSQL_stmt_open,
  PLpgSQLElsifNode,
  PLpgSQLCaseWhenNode,
  PLpgSQLException,
  PLpgSQLRaiseOption,
} from 'plpgsql-deparser';
import type {
  HydratedExprQuery,
  HydratedExprSqlStmt,
  HydratedExprSqlExpr,
  HydratedExprAssign,
} from 'plpgsql-deparser';

// PL/pgSQL node tag types
export type PlpgsqlNodeTag =
  | 'PLpgSQL_function'
  | 'PLpgSQL_var'
  | 'PLpgSQL_rec'
  | 'PLpgSQL_row'
  | 'PLpgSQL_recfield'
  | 'PLpgSQL_type'
  | 'PLpgSQL_expr'
  | 'PLpgSQL_stmt_block'
  | 'PLpgSQL_stmt_assign'
  | 'PLpgSQL_stmt_if'
  | 'PLpgSQL_stmt_case'
  | 'PLpgSQL_stmt_loop'
  | 'PLpgSQL_stmt_while'
  | 'PLpgSQL_stmt_fori'
  | 'PLpgSQL_stmt_fors'
  | 'PLpgSQL_stmt_forc'
  | 'PLpgSQL_stmt_foreach_a'
  | 'PLpgSQL_stmt_exit'
  | 'PLpgSQL_stmt_return'
  | 'PLpgSQL_stmt_return_next'
  | 'PLpgSQL_stmt_return_query'
  | 'PLpgSQL_stmt_raise'
  | 'PLpgSQL_stmt_assert'
  | 'PLpgSQL_stmt_execsql'
  | 'PLpgSQL_stmt_dynexecute'
  | 'PLpgSQL_stmt_dynfors'
  | 'PLpgSQL_stmt_getdiag'
  | 'PLpgSQL_stmt_open'
  | 'PLpgSQL_stmt_fetch'
  | 'PLpgSQL_stmt_close'
  | 'PLpgSQL_stmt_perform'
  | 'PLpgSQL_stmt_call'
  | 'PLpgSQL_stmt_commit'
  | 'PLpgSQL_stmt_rollback'
  | 'PLpgSQL_stmt_set'
  | 'PLpgSQL_if_elsif'
  | 'PLpgSQL_case_when'
  | 'PLpgSQL_exception'
  | 'PLpgSQL_condition'
  | 'PLpgSQL_raise_option'
  | 'PLpgSQL_diag_item';

export class PlpgsqlNodePath<TTag extends string = string> {
  constructor(
    public tag: TTag,
    public node: any,
    public parent: PlpgsqlNodePath | null = null,
    public keyPath: readonly (string | number)[] = []
  ) {}

  get path(): (string | number)[] {
    return [...this.keyPath];
  }

  get key(): string | number {
    return this.keyPath[this.keyPath.length - 1] ?? '';
  }
}

export type PlpgsqlWalker<TNodePath extends PlpgsqlNodePath = PlpgsqlNodePath> = (
  path: TNodePath,
) => boolean | void;

export type PlpgsqlVisitor = {
  [key: string]: PlpgsqlWalker<PlpgsqlNodePath>;
};

export interface PlpgsqlWalkOptions {
  /**
   * Whether to recurse into hydrated SQL expressions using @pgsql/traverse.
   * Default: true
   */
  walkSqlExpressions?: boolean;
  
  /**
   * SQL visitor to use when walking hydrated SQL expressions.
   * Only used if walkSqlExpressions is true.
   */
  sqlVisitor?: SqlVisitor | SqlWalker;
}

/**
 * Walks the tree of PL/pgSQL AST nodes using a visitor pattern.
 * 
 * If a callback returns `false`, the walk will continue to the next sibling
 * node, rather than recurse into the children of the current node.
 * 
 * @param root - The PL/pgSQL AST node to traverse
 * @param callback - A walker function or visitor object
 * @param options - Walk options
 * @param parent - Parent NodePath (for internal use)
 * @param keyPath - Current key path (for internal use)
 */
export function walkPlpgsqlAst(
  root: any,
  callback: PlpgsqlWalker | PlpgsqlVisitor,
  options: PlpgsqlWalkOptions = {},
  parent: PlpgsqlNodePath | null = null,
  keyPath: readonly (string | number)[] = [],
): void {
  const { walkSqlExpressions = true, sqlVisitor } = options;
  
  const actualCallback: PlpgsqlWalker = typeof callback === 'function'
    ? callback
    : (path: PlpgsqlNodePath) => {
        const visitor = callback as PlpgsqlVisitor;
        const visitFn = visitor[path.tag];
        return visitFn ? visitFn(path) : undefined;
      };

  if (Array.isArray(root)) {
    root.forEach((node, index) => {
      walkPlpgsqlAst(node, actualCallback, options, parent, [...keyPath, index]);
    });
  } else if (typeof root === 'object' && root !== null) {
    const keys = Object.keys(root);
    
    // Check if this is a PL/pgSQL node (single key starting with PLpgSQL_)
    if (keys.length === 1 && keys[0].startsWith('PLpgSQL_')) {
      const tag = keys[0];
      const nodeData = root[tag];
      const path = new PlpgsqlNodePath(tag, nodeData, parent, keyPath);
      
      if (actualCallback(path) === false) {
        return;
      }
      
      // Recurse into child nodes based on node type
      walkNodeChildren(tag, nodeData, actualCallback, options, path);
    } else {
      // Not a PL/pgSQL node wrapper, check for nested structures
      for (const key of keys) {
        const value = root[key];
        if (typeof value === 'object' && value !== null) {
          walkPlpgsqlAst(value, actualCallback, options, parent, [...keyPath, key]);
        }
      }
    }
  }
  
  // Helper function to walk into hydrated SQL expressions
  function walkHydratedExpr(expr: any, exprPath: PlpgsqlNodePath) {
    if (!walkSqlExpressions || !expr) return;
    
    // Check if this is a hydrated expression
    if (expr.query && typeof expr.query === 'object' && 'kind' in expr.query) {
      const hydratedQuery = expr.query as HydratedExprQuery;
      
      if (hydratedQuery.kind === 'sql-stmt') {
        const sqlStmt = hydratedQuery as HydratedExprSqlStmt;
        if (sqlStmt.parseResult && sqlVisitor) {
          walkSqlAst(sqlStmt.parseResult, sqlVisitor);
        }
      } else if (hydratedQuery.kind === 'sql-expr') {
        const sqlExpr = hydratedQuery as HydratedExprSqlExpr;
        if (sqlExpr.expr && sqlVisitor) {
          walkSqlAst(sqlExpr.expr, sqlVisitor);
        }
      } else if (hydratedQuery.kind === 'assign') {
        const assignExpr = hydratedQuery as HydratedExprAssign;
        if (assignExpr.targetExpr && sqlVisitor) {
          walkSqlAst(assignExpr.targetExpr, sqlVisitor);
        }
        if (assignExpr.valueExpr && sqlVisitor) {
          walkSqlAst(assignExpr.valueExpr, sqlVisitor);
        }
      }
    }
  }
  
  // Helper function to walk children based on node type
  function walkNodeChildren(
    tag: string,
    nodeData: any,
    cb: PlpgsqlWalker,
    opts: PlpgsqlWalkOptions,
    parentPath: PlpgsqlNodePath
  ) {
    switch (tag) {
      case 'PLpgSQL_function': {
        const fn = nodeData as PLpgSQL_function;
        if (fn.datums) {
          fn.datums.forEach((datum, i) => {
            walkPlpgsqlAst(datum, cb, opts, parentPath, [...parentPath.keyPath, 'datums', i]);
          });
        }
        if (fn.action) {
          walkPlpgsqlAst(fn.action, cb, opts, parentPath, [...parentPath.keyPath, 'action']);
        }
        break;
      }
      
      case 'PLpgSQL_var': {
        if (nodeData.datatype) {
          walkPlpgsqlAst(nodeData.datatype, cb, opts, parentPath, [...parentPath.keyPath, 'datatype']);
        }
        if (nodeData.default_val) {
          walkPlpgsqlAst(nodeData.default_val, cb, opts, parentPath, [...parentPath.keyPath, 'default_val']);
        }
        if (nodeData.cursor_explicit_expr) {
          walkPlpgsqlAst(nodeData.cursor_explicit_expr, cb, opts, parentPath, [...parentPath.keyPath, 'cursor_explicit_expr']);
        }
        break;
      }
      
      case 'PLpgSQL_expr': {
        // This is where we recurse into SQL expressions
        walkHydratedExpr(nodeData, parentPath);
        break;
      }
      
      case 'PLpgSQL_stmt_block': {
        const block = nodeData as PLpgSQL_stmt_block;
        if (block.body) {
          block.body.forEach((stmt, i) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        if (block.exceptions?.exc_list) {
          block.exceptions.exc_list.forEach((exc, i) => {
            walkPlpgsqlAst(exc, cb, opts, parentPath, [...parentPath.keyPath, 'exceptions', 'exc_list', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_assign': {
        if (nodeData.expr) {
          walkPlpgsqlAst(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_if': {
        const ifStmt = nodeData as PLpgSQL_stmt_if;
        if (ifStmt.cond) {
          walkPlpgsqlAst(ifStmt.cond, cb, opts, parentPath, [...parentPath.keyPath, 'cond']);
        }
        if (ifStmt.then_body) {
          ifStmt.then_body.forEach((stmt, i) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'then_body', i]);
          });
        }
        if (ifStmt.elsif_list) {
          ifStmt.elsif_list.forEach((elsif, i) => {
            walkPlpgsqlAst(elsif, cb, opts, parentPath, [...parentPath.keyPath, 'elsif_list', i]);
          });
        }
        if (ifStmt.else_body) {
          ifStmt.else_body.forEach((stmt, i) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'else_body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_if_elsif': {
        if (nodeData.cond) {
          walkPlpgsqlAst(nodeData.cond, cb, opts, parentPath, [...parentPath.keyPath, 'cond']);
        }
        if (nodeData.stmts) {
          nodeData.stmts.forEach((stmt: any, i: number) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'stmts', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_case': {
        const caseStmt = nodeData as PLpgSQL_stmt_case;
        if (caseStmt.t_expr) {
          walkPlpgsqlAst(caseStmt.t_expr, cb, opts, parentPath, [...parentPath.keyPath, 't_expr']);
        }
        if (caseStmt.case_when_list) {
          caseStmt.case_when_list.forEach((when, i) => {
            walkPlpgsqlAst(when, cb, opts, parentPath, [...parentPath.keyPath, 'case_when_list', i]);
          });
        }
        if (caseStmt.else_stmts) {
          caseStmt.else_stmts.forEach((stmt, i) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'else_stmts', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_case_when': {
        if (nodeData.expr) {
          walkPlpgsqlAst(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        if (nodeData.stmts) {
          nodeData.stmts.forEach((stmt: any, i: number) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'stmts', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_loop': {
        const loop = nodeData as PLpgSQL_stmt_loop;
        if (loop.body) {
          loop.body.forEach((stmt, i) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_while': {
        const whileStmt = nodeData as PLpgSQL_stmt_while;
        if (whileStmt.cond) {
          walkPlpgsqlAst(whileStmt.cond, cb, opts, parentPath, [...parentPath.keyPath, 'cond']);
        }
        if (whileStmt.body) {
          whileStmt.body.forEach((stmt, i) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_fori': {
        const fori = nodeData as PLpgSQL_stmt_fori;
        if (fori.var) {
          walkPlpgsqlAst(fori.var, cb, opts, parentPath, [...parentPath.keyPath, 'var']);
        }
        if (fori.lower) {
          walkPlpgsqlAst(fori.lower, cb, opts, parentPath, [...parentPath.keyPath, 'lower']);
        }
        if (fori.upper) {
          walkPlpgsqlAst(fori.upper, cb, opts, parentPath, [...parentPath.keyPath, 'upper']);
        }
        if (fori.step) {
          walkPlpgsqlAst(fori.step, cb, opts, parentPath, [...parentPath.keyPath, 'step']);
        }
        if (fori.body) {
          fori.body.forEach((stmt, i) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_fors': {
        const fors = nodeData as PLpgSQL_stmt_fors;
        if (fors.var) {
          walkPlpgsqlAst(fors.var, cb, opts, parentPath, [...parentPath.keyPath, 'var']);
        }
        if (fors.query) {
          walkPlpgsqlAst(fors.query, cb, opts, parentPath, [...parentPath.keyPath, 'query']);
        }
        if (fors.body) {
          fors.body.forEach((stmt, i) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_forc': {
        const forc = nodeData as PLpgSQL_stmt_forc;
        if (forc.var) {
          walkPlpgsqlAst(forc.var, cb, opts, parentPath, [...parentPath.keyPath, 'var']);
        }
        if (forc.argquery) {
          walkPlpgsqlAst(forc.argquery, cb, opts, parentPath, [...parentPath.keyPath, 'argquery']);
        }
        if (forc.body) {
          forc.body.forEach((stmt, i) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_foreach_a': {
        const foreach = nodeData as PLpgSQL_stmt_foreach_a;
        if (foreach.expr) {
          walkPlpgsqlAst(foreach.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        if (foreach.body) {
          foreach.body.forEach((stmt, i) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_exit': {
        if (nodeData.cond) {
          walkPlpgsqlAst(nodeData.cond, cb, opts, parentPath, [...parentPath.keyPath, 'cond']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_return': {
        if (nodeData.expr) {
          walkPlpgsqlAst(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_return_next': {
        if (nodeData.expr) {
          walkPlpgsqlAst(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_return_query': {
        const retQuery = nodeData as PLpgSQL_stmt_return_query;
        if (retQuery.query) {
          walkPlpgsqlAst(retQuery.query, cb, opts, parentPath, [...parentPath.keyPath, 'query']);
        }
        if (retQuery.dynquery) {
          walkPlpgsqlAst(retQuery.dynquery, cb, opts, parentPath, [...parentPath.keyPath, 'dynquery']);
        }
        if (retQuery.params) {
          retQuery.params.forEach((param, i) => {
            walkPlpgsqlAst(param, cb, opts, parentPath, [...parentPath.keyPath, 'params', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_raise': {
        const raise = nodeData as PLpgSQL_stmt_raise;
        if (raise.params) {
          raise.params.forEach((param, i) => {
            walkPlpgsqlAst(param, cb, opts, parentPath, [...parentPath.keyPath, 'params', i]);
          });
        }
        if (raise.options) {
          raise.options.forEach((opt, i) => {
            walkPlpgsqlAst(opt, cb, opts, parentPath, [...parentPath.keyPath, 'options', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_raise_option': {
        if (nodeData.expr) {
          walkPlpgsqlAst(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_assert': {
        if (nodeData.cond) {
          walkPlpgsqlAst(nodeData.cond, cb, opts, parentPath, [...parentPath.keyPath, 'cond']);
        }
        if (nodeData.message) {
          walkPlpgsqlAst(nodeData.message, cb, opts, parentPath, [...parentPath.keyPath, 'message']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_execsql': {
        if (nodeData.sqlstmt) {
          walkPlpgsqlAst(nodeData.sqlstmt, cb, opts, parentPath, [...parentPath.keyPath, 'sqlstmt']);
        }
        if (nodeData.target) {
          walkPlpgsqlAst(nodeData.target, cb, opts, parentPath, [...parentPath.keyPath, 'target']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_dynexecute': {
        const dynexec = nodeData as PLpgSQL_stmt_dynexecute;
        if (dynexec.query) {
          walkPlpgsqlAst(dynexec.query, cb, opts, parentPath, [...parentPath.keyPath, 'query']);
        }
        if (dynexec.target) {
          walkPlpgsqlAst(dynexec.target, cb, opts, parentPath, [...parentPath.keyPath, 'target']);
        }
        if (dynexec.params) {
          dynexec.params.forEach((param, i) => {
            walkPlpgsqlAst(param, cb, opts, parentPath, [...parentPath.keyPath, 'params', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_dynfors': {
        const dynfors = nodeData as PLpgSQL_stmt_dynfors;
        if (dynfors.var) {
          walkPlpgsqlAst(dynfors.var, cb, opts, parentPath, [...parentPath.keyPath, 'var']);
        }
        if (dynfors.query) {
          walkPlpgsqlAst(dynfors.query, cb, opts, parentPath, [...parentPath.keyPath, 'query']);
        }
        if (dynfors.params) {
          dynfors.params.forEach((param, i) => {
            walkPlpgsqlAst(param, cb, opts, parentPath, [...parentPath.keyPath, 'params', i]);
          });
        }
        if (dynfors.body) {
          dynfors.body.forEach((stmt, i) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_open': {
        const open = nodeData as PLpgSQL_stmt_open;
        if (open.argquery) {
          walkPlpgsqlAst(open.argquery, cb, opts, parentPath, [...parentPath.keyPath, 'argquery']);
        }
        if (open.query) {
          walkPlpgsqlAst(open.query, cb, opts, parentPath, [...parentPath.keyPath, 'query']);
        }
        if (open.dynquery) {
          walkPlpgsqlAst(open.dynquery, cb, opts, parentPath, [...parentPath.keyPath, 'dynquery']);
        }
        if (open.params) {
          open.params.forEach((param, i) => {
            walkPlpgsqlAst(param, cb, opts, parentPath, [...parentPath.keyPath, 'params', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_fetch': {
        if (nodeData.target) {
          walkPlpgsqlAst(nodeData.target, cb, opts, parentPath, [...parentPath.keyPath, 'target']);
        }
        if (nodeData.expr) {
          walkPlpgsqlAst(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_perform': {
        if (nodeData.expr) {
          walkPlpgsqlAst(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_call': {
        if (nodeData.expr) {
          walkPlpgsqlAst(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        if (nodeData.target) {
          walkPlpgsqlAst(nodeData.target, cb, opts, parentPath, [...parentPath.keyPath, 'target']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_set': {
        if (nodeData.expr) {
          walkPlpgsqlAst(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_exception': {
        if (nodeData.conditions) {
          nodeData.conditions.forEach((cond: any, i: number) => {
            walkPlpgsqlAst(cond, cb, opts, parentPath, [...parentPath.keyPath, 'conditions', i]);
          });
        }
        if (nodeData.action) {
          nodeData.action.forEach((stmt: any, i: number) => {
            walkPlpgsqlAst(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'action', i]);
          });
        }
        break;
      }
      
      // Nodes with no children to traverse
      case 'PLpgSQL_rec':
      case 'PLpgSQL_row':
      case 'PLpgSQL_recfield':
      case 'PLpgSQL_type':
      case 'PLpgSQL_stmt_getdiag':
      case 'PLpgSQL_stmt_close':
      case 'PLpgSQL_stmt_commit':
      case 'PLpgSQL_stmt_rollback':
      case 'PLpgSQL_condition':
      case 'PLpgSQL_diag_item':
        // No children to traverse
        break;
      
      default:
        // Unknown node type - try to traverse any object/array children
        for (const key in nodeData) {
          const value = nodeData[key];
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              if (typeof item === 'object' && item !== null) {
                walkPlpgsqlAst(item, cb, opts, parentPath, [...parentPath.keyPath, key, index]);
              }
            });
          } else if (typeof value === 'object' && value !== null) {
            walkPlpgsqlAst(value, cb, opts, parentPath, [...parentPath.keyPath, key]);
          }
        }
    }
  }
}
