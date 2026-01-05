/**
 * PL/pgSQL AST Traversal
 * 
 * Provides a visitor pattern for traversing PL/pgSQL ASTs, similar to @pgsql/traverse
 * but designed for PL/pgSQL node types. Automatically recurses into hydrated SQL
 * expressions using @pgsql/traverse.
 */

import { walk as walkSql } from '@pgsql/traverse';
import type { Walker as SqlWalker, Visitor as SqlVisitor, NodePath as SqlNodePath } from '@pgsql/traverse';
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
export type PLpgSQLNodeTag =
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

export class PLpgSQLNodePath<TTag extends string = string> {
  constructor(
    public tag: TTag,
    public node: any,
    public parent: PLpgSQLNodePath | null = null,
    public keyPath: readonly (string | number)[] = []
  ) {}

  get path(): (string | number)[] {
    return [...this.keyPath];
  }

  get key(): string | number {
    return this.keyPath[this.keyPath.length - 1] ?? '';
  }
}

export type PLpgSQLWalker<TNodePath extends PLpgSQLNodePath = PLpgSQLNodePath> = (
  path: TNodePath,
) => boolean | void;

export type PLpgSQLVisitor = {
  [key: string]: PLpgSQLWalker<PLpgSQLNodePath>;
};

export interface WalkOptions {
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
export function walk(
  root: any,
  callback: PLpgSQLWalker | PLpgSQLVisitor,
  options: WalkOptions = {},
  parent: PLpgSQLNodePath | null = null,
  keyPath: readonly (string | number)[] = [],
): void {
  const { walkSqlExpressions = true, sqlVisitor } = options;
  
  const actualCallback: PLpgSQLWalker = typeof callback === 'function'
    ? callback
    : (path: PLpgSQLNodePath) => {
        const visitor = callback as PLpgSQLVisitor;
        const visitFn = visitor[path.tag];
        return visitFn ? visitFn(path) : undefined;
      };

  if (Array.isArray(root)) {
    root.forEach((node, index) => {
      walk(node, actualCallback, options, parent, [...keyPath, index]);
    });
  } else if (typeof root === 'object' && root !== null) {
    const keys = Object.keys(root);
    
    // Check if this is a PL/pgSQL node (single key starting with PLpgSQL_)
    if (keys.length === 1 && keys[0].startsWith('PLpgSQL_')) {
      const tag = keys[0];
      const nodeData = root[tag];
      const path = new PLpgSQLNodePath(tag, nodeData, parent, keyPath);
      
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
          walk(value, actualCallback, options, parent, [...keyPath, key]);
        }
      }
    }
  }
  
  // Helper function to walk into hydrated SQL expressions
  function walkHydratedExpr(expr: any, exprPath: PLpgSQLNodePath) {
    if (!walkSqlExpressions || !expr) return;
    
    // Check if this is a hydrated expression
    if (expr.query && typeof expr.query === 'object' && 'kind' in expr.query) {
      const hydratedQuery = expr.query as HydratedExprQuery;
      
      if (hydratedQuery.kind === 'sql-stmt') {
        const sqlStmt = hydratedQuery as HydratedExprSqlStmt;
        if (sqlStmt.parseResult && sqlVisitor) {
          walkSql(sqlStmt.parseResult, sqlVisitor);
        }
      } else if (hydratedQuery.kind === 'sql-expr') {
        const sqlExpr = hydratedQuery as HydratedExprSqlExpr;
        if (sqlExpr.expr && sqlVisitor) {
          walkSql(sqlExpr.expr, sqlVisitor);
        }
      } else if (hydratedQuery.kind === 'assign') {
        const assignExpr = hydratedQuery as HydratedExprAssign;
        if (assignExpr.targetExpr && sqlVisitor) {
          walkSql(assignExpr.targetExpr, sqlVisitor);
        }
        if (assignExpr.valueExpr && sqlVisitor) {
          walkSql(assignExpr.valueExpr, sqlVisitor);
        }
      }
    }
  }
  
  // Helper function to walk children based on node type
  function walkNodeChildren(
    tag: string,
    nodeData: any,
    cb: PLpgSQLWalker,
    opts: WalkOptions,
    parentPath: PLpgSQLNodePath
  ) {
    switch (tag) {
      case 'PLpgSQL_function': {
        const fn = nodeData as PLpgSQL_function;
        if (fn.datums) {
          fn.datums.forEach((datum, i) => {
            walk(datum, cb, opts, parentPath, [...parentPath.keyPath, 'datums', i]);
          });
        }
        if (fn.action) {
          walk(fn.action, cb, opts, parentPath, [...parentPath.keyPath, 'action']);
        }
        break;
      }
      
      case 'PLpgSQL_var': {
        if (nodeData.datatype) {
          walk(nodeData.datatype, cb, opts, parentPath, [...parentPath.keyPath, 'datatype']);
        }
        if (nodeData.default_val) {
          walk(nodeData.default_val, cb, opts, parentPath, [...parentPath.keyPath, 'default_val']);
        }
        if (nodeData.cursor_explicit_expr) {
          walk(nodeData.cursor_explicit_expr, cb, opts, parentPath, [...parentPath.keyPath, 'cursor_explicit_expr']);
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
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        if (block.exceptions?.exc_list) {
          block.exceptions.exc_list.forEach((exc, i) => {
            walk(exc, cb, opts, parentPath, [...parentPath.keyPath, 'exceptions', 'exc_list', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_assign': {
        if (nodeData.expr) {
          walk(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_if': {
        const ifStmt = nodeData as PLpgSQL_stmt_if;
        if (ifStmt.cond) {
          walk(ifStmt.cond, cb, opts, parentPath, [...parentPath.keyPath, 'cond']);
        }
        if (ifStmt.then_body) {
          ifStmt.then_body.forEach((stmt, i) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'then_body', i]);
          });
        }
        if (ifStmt.elsif_list) {
          ifStmt.elsif_list.forEach((elsif, i) => {
            walk(elsif, cb, opts, parentPath, [...parentPath.keyPath, 'elsif_list', i]);
          });
        }
        if (ifStmt.else_body) {
          ifStmt.else_body.forEach((stmt, i) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'else_body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_if_elsif': {
        if (nodeData.cond) {
          walk(nodeData.cond, cb, opts, parentPath, [...parentPath.keyPath, 'cond']);
        }
        if (nodeData.stmts) {
          nodeData.stmts.forEach((stmt: any, i: number) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'stmts', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_case': {
        const caseStmt = nodeData as PLpgSQL_stmt_case;
        if (caseStmt.t_expr) {
          walk(caseStmt.t_expr, cb, opts, parentPath, [...parentPath.keyPath, 't_expr']);
        }
        if (caseStmt.case_when_list) {
          caseStmt.case_when_list.forEach((when, i) => {
            walk(when, cb, opts, parentPath, [...parentPath.keyPath, 'case_when_list', i]);
          });
        }
        if (caseStmt.else_stmts) {
          caseStmt.else_stmts.forEach((stmt, i) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'else_stmts', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_case_when': {
        if (nodeData.expr) {
          walk(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        if (nodeData.stmts) {
          nodeData.stmts.forEach((stmt: any, i: number) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'stmts', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_loop': {
        const loop = nodeData as PLpgSQL_stmt_loop;
        if (loop.body) {
          loop.body.forEach((stmt, i) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_while': {
        const whileStmt = nodeData as PLpgSQL_stmt_while;
        if (whileStmt.cond) {
          walk(whileStmt.cond, cb, opts, parentPath, [...parentPath.keyPath, 'cond']);
        }
        if (whileStmt.body) {
          whileStmt.body.forEach((stmt, i) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_fori': {
        const fori = nodeData as PLpgSQL_stmt_fori;
        if (fori.var) {
          walk(fori.var, cb, opts, parentPath, [...parentPath.keyPath, 'var']);
        }
        if (fori.lower) {
          walk(fori.lower, cb, opts, parentPath, [...parentPath.keyPath, 'lower']);
        }
        if (fori.upper) {
          walk(fori.upper, cb, opts, parentPath, [...parentPath.keyPath, 'upper']);
        }
        if (fori.step) {
          walk(fori.step, cb, opts, parentPath, [...parentPath.keyPath, 'step']);
        }
        if (fori.body) {
          fori.body.forEach((stmt, i) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_fors': {
        const fors = nodeData as PLpgSQL_stmt_fors;
        if (fors.var) {
          walk(fors.var, cb, opts, parentPath, [...parentPath.keyPath, 'var']);
        }
        if (fors.query) {
          walk(fors.query, cb, opts, parentPath, [...parentPath.keyPath, 'query']);
        }
        if (fors.body) {
          fors.body.forEach((stmt, i) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_forc': {
        const forc = nodeData as PLpgSQL_stmt_forc;
        if (forc.var) {
          walk(forc.var, cb, opts, parentPath, [...parentPath.keyPath, 'var']);
        }
        if (forc.argquery) {
          walk(forc.argquery, cb, opts, parentPath, [...parentPath.keyPath, 'argquery']);
        }
        if (forc.body) {
          forc.body.forEach((stmt, i) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_foreach_a': {
        const foreach = nodeData as PLpgSQL_stmt_foreach_a;
        if (foreach.expr) {
          walk(foreach.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        if (foreach.body) {
          foreach.body.forEach((stmt, i) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_exit': {
        if (nodeData.cond) {
          walk(nodeData.cond, cb, opts, parentPath, [...parentPath.keyPath, 'cond']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_return': {
        if (nodeData.expr) {
          walk(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_return_next': {
        if (nodeData.expr) {
          walk(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_return_query': {
        const retQuery = nodeData as PLpgSQL_stmt_return_query;
        if (retQuery.query) {
          walk(retQuery.query, cb, opts, parentPath, [...parentPath.keyPath, 'query']);
        }
        if (retQuery.dynquery) {
          walk(retQuery.dynquery, cb, opts, parentPath, [...parentPath.keyPath, 'dynquery']);
        }
        if (retQuery.params) {
          retQuery.params.forEach((param, i) => {
            walk(param, cb, opts, parentPath, [...parentPath.keyPath, 'params', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_raise': {
        const raise = nodeData as PLpgSQL_stmt_raise;
        if (raise.params) {
          raise.params.forEach((param, i) => {
            walk(param, cb, opts, parentPath, [...parentPath.keyPath, 'params', i]);
          });
        }
        if (raise.options) {
          raise.options.forEach((opt, i) => {
            walk(opt, cb, opts, parentPath, [...parentPath.keyPath, 'options', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_raise_option': {
        if (nodeData.expr) {
          walk(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_assert': {
        if (nodeData.cond) {
          walk(nodeData.cond, cb, opts, parentPath, [...parentPath.keyPath, 'cond']);
        }
        if (nodeData.message) {
          walk(nodeData.message, cb, opts, parentPath, [...parentPath.keyPath, 'message']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_execsql': {
        if (nodeData.sqlstmt) {
          walk(nodeData.sqlstmt, cb, opts, parentPath, [...parentPath.keyPath, 'sqlstmt']);
        }
        if (nodeData.target) {
          walk(nodeData.target, cb, opts, parentPath, [...parentPath.keyPath, 'target']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_dynexecute': {
        const dynexec = nodeData as PLpgSQL_stmt_dynexecute;
        if (dynexec.query) {
          walk(dynexec.query, cb, opts, parentPath, [...parentPath.keyPath, 'query']);
        }
        if (dynexec.target) {
          walk(dynexec.target, cb, opts, parentPath, [...parentPath.keyPath, 'target']);
        }
        if (dynexec.params) {
          dynexec.params.forEach((param, i) => {
            walk(param, cb, opts, parentPath, [...parentPath.keyPath, 'params', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_dynfors': {
        const dynfors = nodeData as PLpgSQL_stmt_dynfors;
        if (dynfors.var) {
          walk(dynfors.var, cb, opts, parentPath, [...parentPath.keyPath, 'var']);
        }
        if (dynfors.query) {
          walk(dynfors.query, cb, opts, parentPath, [...parentPath.keyPath, 'query']);
        }
        if (dynfors.params) {
          dynfors.params.forEach((param, i) => {
            walk(param, cb, opts, parentPath, [...parentPath.keyPath, 'params', i]);
          });
        }
        if (dynfors.body) {
          dynfors.body.forEach((stmt, i) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'body', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_open': {
        const open = nodeData as PLpgSQL_stmt_open;
        if (open.argquery) {
          walk(open.argquery, cb, opts, parentPath, [...parentPath.keyPath, 'argquery']);
        }
        if (open.query) {
          walk(open.query, cb, opts, parentPath, [...parentPath.keyPath, 'query']);
        }
        if (open.dynquery) {
          walk(open.dynquery, cb, opts, parentPath, [...parentPath.keyPath, 'dynquery']);
        }
        if (open.params) {
          open.params.forEach((param, i) => {
            walk(param, cb, opts, parentPath, [...parentPath.keyPath, 'params', i]);
          });
        }
        break;
      }
      
      case 'PLpgSQL_stmt_fetch': {
        if (nodeData.target) {
          walk(nodeData.target, cb, opts, parentPath, [...parentPath.keyPath, 'target']);
        }
        if (nodeData.expr) {
          walk(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_perform': {
        if (nodeData.expr) {
          walk(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_call': {
        if (nodeData.expr) {
          walk(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        if (nodeData.target) {
          walk(nodeData.target, cb, opts, parentPath, [...parentPath.keyPath, 'target']);
        }
        break;
      }
      
      case 'PLpgSQL_stmt_set': {
        if (nodeData.expr) {
          walk(nodeData.expr, cb, opts, parentPath, [...parentPath.keyPath, 'expr']);
        }
        break;
      }
      
      case 'PLpgSQL_exception': {
        if (nodeData.conditions) {
          nodeData.conditions.forEach((cond: any, i: number) => {
            walk(cond, cb, opts, parentPath, [...parentPath.keyPath, 'conditions', i]);
          });
        }
        if (nodeData.action) {
          nodeData.action.forEach((stmt: any, i: number) => {
            walk(stmt, cb, opts, parentPath, [...parentPath.keyPath, 'action', i]);
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
                walk(item, cb, opts, parentPath, [...parentPath.keyPath, key, index]);
              }
            });
          } else if (typeof value === 'object' && value !== null) {
            walk(value, cb, opts, parentPath, [...parentPath.keyPath, key]);
          }
        }
    }
  }
}

/**
 * Convenience function to walk a parsed script from plpgsql-parser.
 * Walks both the SQL statements and PL/pgSQL function bodies.
 */
export function walkParsedScript(
  parsed: { sql: any; functions: Array<{ plpgsql: { hydrated: any } }> },
  plpgsqlVisitor: PLpgSQLVisitor | PLpgSQLWalker,
  sqlVisitor?: SqlVisitor | SqlWalker,
): void {
  // Walk SQL statements
  if (sqlVisitor && parsed.sql) {
    walkSql(parsed.sql, sqlVisitor);
  }
  
  // Walk PL/pgSQL function bodies
  for (const fn of parsed.functions) {
    if (fn.plpgsql?.hydrated) {
      walk(fn.plpgsql.hydrated, plpgsqlVisitor, { 
        walkSqlExpressions: true, 
        sqlVisitor 
      });
    }
  }
}
