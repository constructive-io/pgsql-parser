/**
 * PL/pgSQL Deparser
 * 
 * Converts PL/pgSQL function ASTs back to SQL strings.
 * This deparser handles the internal PL/pgSQL AST structure returned by
 * parsePlPgSQL from libpg-query, which is different from the regular SQL AST.
 * 
 * Note: The PL/pgSQL AST represents the internal structure of function bodies,
 * not the CREATE FUNCTION statement itself. To get a complete function definition,
 * you would need to combine this with the regular SQL deparser for the outer
 * CREATE FUNCTION statement.
 */

import { Deparser as SqlDeparser } from 'pgsql-deparser';
import {
  PLpgSQLParseResult,
  PLpgSQLFunctionNode,
  PLpgSQL_function,
  PLpgSQLDatum,
  PLpgSQL_var,
  PLpgSQL_rec,
  PLpgSQL_row,
  PLpgSQLStmtNode,
  PLpgSQL_stmt_block,
  PLpgSQL_stmt_assign,
  PLpgSQL_stmt_if,
  PLpgSQL_stmt_case,
  PLpgSQL_stmt_loop,
  PLpgSQL_stmt_while,
  PLpgSQL_stmt_fori,
  PLpgSQL_stmt_fors,
  PLpgSQL_stmt_forc,
  PLpgSQL_stmt_foreach_a,
  PLpgSQL_stmt_exit,
  PLpgSQL_stmt_return,
  PLpgSQL_stmt_return_next,
  PLpgSQL_stmt_return_query,
  PLpgSQL_stmt_raise,
  PLpgSQL_stmt_assert,
  PLpgSQL_stmt_execsql,
  PLpgSQL_stmt_dynexecute,
  PLpgSQL_stmt_dynfors,
  PLpgSQL_stmt_getdiag,
  PLpgSQL_stmt_open,
  PLpgSQL_stmt_fetch,
  PLpgSQL_stmt_close,
  PLpgSQL_stmt_perform,
  PLpgSQL_stmt_call,
  PLpgSQL_stmt_commit,
  PLpgSQL_stmt_rollback,
  PLpgSQL_stmt_set,
  PLpgSQLExprNode,
  PLpgSQLTypeNode,
  PLpgSQLCaseWhenNode,
  PLpgSQLElsifNode,
  ElogLevel,
  FetchDirection,
  DiagItemKind,
  RaiseOptionType,
} from './types';

export interface PLpgSQLDeparserOptions {
  indent?: string;
  newline?: string;
  uppercase?: boolean;
}

/**
 * Return type information for a PL/pgSQL function.
 * Used to determine the correct RETURN statement syntax:
 * - void/setof/trigger/out_params: bare RETURN is valid
 * - scalar: RETURN NULL is required for empty returns
 */
export type ReturnInfoKind = 'void' | 'setof' | 'trigger' | 'scalar' | 'out_params';

export interface ReturnInfo {
  kind: ReturnInfoKind;
}

export interface PLpgSQLDeparserContext {
  indentLevel: number;
  options: PLpgSQLDeparserOptions;
  datums?: PLpgSQLDatum[];
  returnInfo?: ReturnInfo;
}

/**
 * PL/pgSQL Deparser class
 * 
 * Converts PL/pgSQL AST nodes back to SQL strings using a visitor pattern.
 */
export class PLpgSQLDeparser {
  private options: PLpgSQLDeparserOptions;

  constructor(options: PLpgSQLDeparserOptions = {}) {
    this.options = {
      indent: '  ',
      newline: '\n',
      uppercase: true,
      ...options,
    };
  }

  /**
   * Static method to deparse a PL/pgSQL parse result
   * @param parseResult - The PL/pgSQL parse result
   * @param options - Deparser options
   * @param returnInfo - Optional return type info for correct RETURN statement handling
   */
  static deparse(parseResult: PLpgSQLParseResult, options?: PLpgSQLDeparserOptions, returnInfo?: ReturnInfo): string {
    return new PLpgSQLDeparser(options).deparseResult(parseResult, returnInfo);
  }

  /**
   * Static method to deparse a single PL/pgSQL function body
   * @param func - The PL/pgSQL function AST
   * @param options - Deparser options
   * @param returnInfo - Optional return type info for correct RETURN statement handling
   */
  static deparseFunction(func: PLpgSQL_function, options?: PLpgSQLDeparserOptions, returnInfo?: ReturnInfo): string {
    return new PLpgSQLDeparser(options).deparseFunction(func, returnInfo);
  }

  /**
   * Deparse a complete PL/pgSQL parse result
   * @param parseResult - The PL/pgSQL parse result
   * @param returnInfo - Optional return type info for correct RETURN statement handling
   */
  deparseResult(parseResult: PLpgSQLParseResult, returnInfo?: ReturnInfo): string {
    if (!parseResult.plpgsql_funcs || parseResult.plpgsql_funcs.length === 0) {
      return '';
    }

    return parseResult.plpgsql_funcs
      .map(func => this.deparseFunctionNode(func, returnInfo))
      .join(this.options.newline + this.options.newline);
  }

  /**
   * Deparse a PLpgSQL_function node wrapper
   * @param node - The PLpgSQL_function node wrapper
   * @param returnInfo - Optional return type info for correct RETURN statement handling
   */
  deparseFunctionNode(node: PLpgSQLFunctionNode, returnInfo?: ReturnInfo): string {
    if ('PLpgSQL_function' in node) {
      return this.deparseFunction(node.PLpgSQL_function, returnInfo);
    }
    throw new Error('Unknown function node type');
  }

  /**
   * Deparse a PL/pgSQL function body
   * @param func - The PL/pgSQL function AST
   * @param returnInfo - Optional return type info for correct RETURN statement handling
   */
  deparseFunction(func: PLpgSQL_function, returnInfo?: ReturnInfo): string {
    const context: PLpgSQLDeparserContext = {
      indentLevel: 0,
      options: this.options,
      datums: func.datums,
      returnInfo,
    };

    const parts: string[] = [];

    // Collect loop-introduced variables before generating DECLARE section
    const loopVarLinenos = new Set<number>();
    if (func.action) {
      this.collectLoopVariables(func.action, loopVarLinenos);
    }

    // Deparse DECLARE section (local variables, excluding loop variables)
    const declareSection = this.deparseDeclareSection(func.datums, context, loopVarLinenos);
    if (declareSection) {
      parts.push(declareSection);
    }

    // Deparse the action block (BEGIN...END)
    if (func.action) {
      parts.push(this.deparseStmt(func.action, context));
    }

    return parts.join(this.options.newline);
  }

  /**
   * Collect line numbers of variables introduced by loop constructs.
   * Only adds a variable's lineno if it matches the loop statement's lineno,
   * indicating the variable was implicitly declared by the loop (not explicitly in DECLARE).
   */
  private collectLoopVariables(stmt: PLpgSQLStmtNode, loopVarLinenos: Set<number>): void {
    if ('PLpgSQL_stmt_block' in stmt) {
      const block = stmt.PLpgSQL_stmt_block;
      if (block.body) {
        for (const s of block.body) {
          this.collectLoopVariables(s, loopVarLinenos);
        }
      }
    } else if ('PLpgSQL_stmt_fori' in stmt) {
      // Integer FOR loop - only exclude if var.lineno matches stmt.lineno (implicit declaration)
      const fori = stmt.PLpgSQL_stmt_fori;
      const stmtLineno = fori.lineno;
      if (fori.var && 'PLpgSQL_var' in fori.var) {
        const varLineno = fori.var.PLpgSQL_var.lineno;
        if (varLineno !== undefined && varLineno === stmtLineno) {
          loopVarLinenos.add(varLineno);
        }
      }
      if (fori.body) {
        for (const s of fori.body) {
          this.collectLoopVariables(s, loopVarLinenos);
        }
      }
    } else if ('PLpgSQL_stmt_fors' in stmt) {
      // Query FOR loop - only exclude if var.lineno matches stmt.lineno (implicit declaration)
      const fors = stmt.PLpgSQL_stmt_fors;
      const stmtLineno = fors.lineno;
      if (fors.var && 'PLpgSQL_rec' in fors.var) {
        const varLineno = fors.var.PLpgSQL_rec.lineno;
        if (varLineno !== undefined && varLineno === stmtLineno) {
          loopVarLinenos.add(varLineno);
        }
      }
      if (fors.var && 'PLpgSQL_row' in fors.var) {
        const varLineno = fors.var.PLpgSQL_row.lineno;
        if (varLineno !== undefined && varLineno === stmtLineno) {
          loopVarLinenos.add(varLineno);
        }
      }
      if (fors.body) {
        for (const s of fors.body) {
          this.collectLoopVariables(s, loopVarLinenos);
        }
      }
    } else if ('PLpgSQL_stmt_forc' in stmt) {
      // Cursor FOR loop - only exclude if var.lineno matches stmt.lineno (implicit declaration)
      const forc = stmt.PLpgSQL_stmt_forc;
      const stmtLineno = forc.lineno;
      if (forc.var && 'PLpgSQL_rec' in forc.var) {
        const varLineno = forc.var.PLpgSQL_rec.lineno;
        if (varLineno !== undefined && varLineno === stmtLineno) {
          loopVarLinenos.add(varLineno);
        }
      }
      if (forc.body) {
        for (const s of forc.body) {
          this.collectLoopVariables(s, loopVarLinenos);
        }
      }
    } else if ('PLpgSQL_stmt_foreach_a' in stmt) {
      // FOREACH loop - uses varno reference, not embedded var
      // The variable is referenced by index, so we can't easily exclude it here
      // Just recurse into the body
      const foreach = stmt.PLpgSQL_stmt_foreach_a;
      if (foreach.body) {
        for (const s of foreach.body) {
          this.collectLoopVariables(s, loopVarLinenos);
        }
      }
    } else if ('PLpgSQL_stmt_dynfors' in stmt) {
      // Dynamic FOR loop - only exclude if var.lineno matches stmt.lineno (implicit declaration)
      const dynfors = stmt.PLpgSQL_stmt_dynfors;
      const stmtLineno = dynfors.lineno;
      if (dynfors.var && 'PLpgSQL_rec' in dynfors.var) {
        const varLineno = dynfors.var.PLpgSQL_rec.lineno;
        if (varLineno !== undefined && varLineno === stmtLineno) {
          loopVarLinenos.add(varLineno);
        }
      }
      if (dynfors.body) {
        for (const s of dynfors.body) {
          this.collectLoopVariables(s, loopVarLinenos);
        }
      }
    } else if ('PLpgSQL_stmt_if' in stmt) {
      const ifStmt = stmt.PLpgSQL_stmt_if;
      if (ifStmt.then_body) {
        for (const s of ifStmt.then_body) {
          this.collectLoopVariables(s, loopVarLinenos);
        }
      }
      if (ifStmt.elsif_list) {
        for (const elsif of ifStmt.elsif_list) {
          if ('PLpgSQL_if_elsif' in elsif && elsif.PLpgSQL_if_elsif.stmts) {
            for (const s of elsif.PLpgSQL_if_elsif.stmts) {
              this.collectLoopVariables(s, loopVarLinenos);
            }
          }
        }
      }
      if (ifStmt.else_body) {
        for (const s of ifStmt.else_body) {
          this.collectLoopVariables(s, loopVarLinenos);
        }
      }
    } else if ('PLpgSQL_stmt_case' in stmt) {
      const caseStmt = stmt.PLpgSQL_stmt_case;
      if (caseStmt.case_when_list) {
        for (const when of caseStmt.case_when_list) {
          if ('PLpgSQL_case_when' in when && when.PLpgSQL_case_when.stmts) {
            for (const s of when.PLpgSQL_case_when.stmts) {
              this.collectLoopVariables(s, loopVarLinenos);
            }
          }
        }
      }
      if (caseStmt.have_else && caseStmt.else_stmts) {
        for (const s of caseStmt.else_stmts) {
          this.collectLoopVariables(s, loopVarLinenos);
        }
      }
    } else if ('PLpgSQL_stmt_loop' in stmt) {
      const loop = stmt.PLpgSQL_stmt_loop;
      if (loop.body) {
        for (const s of loop.body) {
          this.collectLoopVariables(s, loopVarLinenos);
        }
      }
    } else if ('PLpgSQL_stmt_while' in stmt) {
      const whileStmt = stmt.PLpgSQL_stmt_while;
      if (whileStmt.body) {
        for (const s of whileStmt.body) {
          this.collectLoopVariables(s, loopVarLinenos);
        }
      }
    }
  }

  /**
   * Deparse the DECLARE section
   */
  private deparseDeclareSection(
    datums: PLpgSQLDatum[] | undefined,
    context: PLpgSQLDeparserContext,
    loopVarLinenos: Set<number> = new Set()
  ): string {
    if (!datums || datums.length === 0) {
      return '';
    }

    // Filter out internal variables (like 'found', parameters, etc.) and loop variables
    const localVars = datums.filter(datum => {
      if ('PLpgSQL_var' in datum) {
        const v = datum.PLpgSQL_var;
        // Skip internal variables
        if (v.refname === 'found' || v.refname.startsWith('__')) {
          return false;
        }
        // Skip variables without lineno (usually parameters or internal)
        if (v.lineno === undefined) {
          return false;
        }
        // Skip loop-introduced variables
        if (loopVarLinenos.has(v.lineno)) {
          return false;
        }
        return true;
      }
      if ('PLpgSQL_rec' in datum) {
        const rec = datum.PLpgSQL_rec;
        if (rec.lineno === undefined) {
          return false;
        }
        // Skip loop-introduced records
        if (loopVarLinenos.has(rec.lineno)) {
          return false;
        }
        return true;
      }
      return false;
    });

    if (localVars.length === 0) {
      return '';
    }

    const kw = this.keyword;
    const parts: string[] = [kw('DECLARE')];

    for (const datum of localVars) {
      const varDecl = this.deparseDatum(datum, context);
      if (varDecl) {
        parts.push(this.indent(varDecl + ';', context.indentLevel + 1));
      }
    }

    return parts.join(this.options.newline);
  }

  /**
   * Deparse a datum (variable declaration)
   */
  private deparseDatum(datum: PLpgSQLDatum, context: PLpgSQLDeparserContext): string {
    if ('PLpgSQL_var' in datum) {
      return this.deparseVar(datum.PLpgSQL_var, context);
    }
    if ('PLpgSQL_rec' in datum) {
      return this.deparseRec(datum.PLpgSQL_rec, context);
    }
    if ('PLpgSQL_row' in datum) {
      return this.deparseRow(datum.PLpgSQL_row, context);
    }
    return '';
  }

  /**
   * Deparse a variable declaration
   */
  private deparseVar(v: PLpgSQL_var, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [v.refname];

    if (v.isconst) {
      parts.push(kw('CONSTANT'));
    }

    if (v.datatype) {
      parts.push(this.deparseType(v.datatype));
    }

    if (v.notnull) {
      parts.push(kw('NOT NULL'));
    }

    if (v.default_val) {
      parts.push(':=');
      parts.push(this.deparseExpr(v.default_val));
    }

    // Handle cursor declarations
    if (v.cursor_explicit_expr) {
      parts.push(kw('CURSOR FOR'));
      parts.push(this.deparseExpr(v.cursor_explicit_expr));
    }

    return parts.join(' ');
  }

  /**
   * Deparse a record declaration
   */
  private deparseRec(rec: PLpgSQL_rec, context: PLpgSQLDeparserContext): string {
    return `${rec.refname} ${this.keyword('RECORD')}`;
  }

  /**
   * Deparse a row declaration
   */
  private deparseRow(row: PLpgSQL_row, context: PLpgSQLDeparserContext): string {
    // Row types are usually internal, but we can represent them
    return `${row.refname} ${this.keyword('RECORD')}`;
  }

  /**
   * Deparse a type reference
   */
  private deparseType(typeNode: PLpgSQLTypeNode): string {
    if ('PLpgSQL_type' in typeNode) {
      let typname = typeNode.PLpgSQL_type.typname;
      // Remove quotes
      typname = typname.replace(/"/g, '');
      // Strip pg_catalog. prefix for built-in types, but preserve schema qualification
      // for %rowtype and %type references where the schema is part of the table/variable reference
      if (!typname.includes('%rowtype') && !typname.includes('%type')) {
        typname = typname.replace(/^pg_catalog\./, '');
      }
      return typname.trim();
    }
    return '';
  }

  /**
   * Deparse an expression
   */
  private deparseExpr(exprNode: PLpgSQLExprNode): string {
    if ('PLpgSQL_expr' in exprNode) {
      return exprNode.PLpgSQL_expr.query;
    }
    return '';
  }

  /**
   * Deparse a statement node
   */
  private deparseStmt(stmt: PLpgSQLStmtNode, context: PLpgSQLDeparserContext): string {
    const nodeType = Object.keys(stmt)[0];
    const nodeData = (stmt as any)[nodeType];

    switch (nodeType) {
      case 'PLpgSQL_stmt_block':
        return this.deparseBlock(nodeData, context);
      case 'PLpgSQL_stmt_assign':
        return this.deparseAssign(nodeData, context);
      case 'PLpgSQL_stmt_if':
        return this.deparseIf(nodeData, context);
      case 'PLpgSQL_stmt_case':
        return this.deparseCase(nodeData, context);
      case 'PLpgSQL_stmt_loop':
        return this.deparseLoop(nodeData, context);
      case 'PLpgSQL_stmt_while':
        return this.deparseWhile(nodeData, context);
      case 'PLpgSQL_stmt_fori':
        return this.deparseFori(nodeData, context);
      case 'PLpgSQL_stmt_fors':
        return this.deparseFors(nodeData, context);
      case 'PLpgSQL_stmt_forc':
        return this.deparseForc(nodeData, context);
      case 'PLpgSQL_stmt_foreach_a':
        return this.deparseForeach(nodeData, context);
      case 'PLpgSQL_stmt_exit':
        return this.deparseExit(nodeData, context);
      case 'PLpgSQL_stmt_return':
        return this.deparseReturn(nodeData, context);
      case 'PLpgSQL_stmt_return_next':
        return this.deparseReturnNext(nodeData, context);
      case 'PLpgSQL_stmt_return_query':
        return this.deparseReturnQuery(nodeData, context);
      case 'PLpgSQL_stmt_raise':
        return this.deparseRaise(nodeData, context);
      case 'PLpgSQL_stmt_assert':
        return this.deparseAssert(nodeData, context);
      case 'PLpgSQL_stmt_execsql':
        return this.deparseExecSql(nodeData, context);
      case 'PLpgSQL_stmt_dynexecute':
        return this.deparseDynExecute(nodeData, context);
      case 'PLpgSQL_stmt_dynfors':
        return this.deparseDynFors(nodeData, context);
      case 'PLpgSQL_stmt_getdiag':
        return this.deparseGetDiag(nodeData, context);
      case 'PLpgSQL_stmt_open':
        return this.deparseOpen(nodeData, context);
      case 'PLpgSQL_stmt_fetch':
        return this.deparseFetch(nodeData, context);
      case 'PLpgSQL_stmt_close':
        return this.deparseClose(nodeData, context);
      case 'PLpgSQL_stmt_perform':
        return this.deparsePerform(nodeData, context);
      case 'PLpgSQL_stmt_call':
        return this.deparseCall(nodeData, context);
      case 'PLpgSQL_stmt_commit':
        return this.deparseCommit(nodeData, context);
      case 'PLpgSQL_stmt_rollback':
        return this.deparseRollback(nodeData, context);
      case 'PLpgSQL_stmt_set':
        return this.deparseSet(nodeData, context);
      default:
        throw new Error(`Unknown PL/pgSQL statement type: ${nodeType}`);
    }
  }

  /**
   * Deparse a block statement (BEGIN...END)
   */
  private deparseBlock(block: PLpgSQL_stmt_block, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [];

    // Label
    if (block.label) {
      parts.push(`<<${block.label}>>`);
    }

    parts.push(kw('BEGIN'));

    // Body statements
    if (block.body) {
      const bodyContext = { ...context, indentLevel: context.indentLevel + 1 };
      for (const stmt of block.body) {
        const stmtStr = this.deparseStmt(stmt, bodyContext);
        parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
      }
    }

    // Exception handlers
    if (block.exceptions?.exc_list) {
      parts.push(kw('EXCEPTION'));
      for (const exc of block.exceptions.exc_list) {
        if ('PLpgSQL_exception' in exc) {
          const excData = exc.PLpgSQL_exception;
          const conditions = excData.conditions?.map(c => {
            if ('PLpgSQL_condition' in c) {
              return c.PLpgSQL_condition.condname || c.PLpgSQL_condition.sqlerrstate || 'OTHERS';
            }
            return 'OTHERS';
          }).join(' OR ') || 'OTHERS';

          parts.push(this.indent(`${kw('WHEN')} ${conditions} ${kw('THEN')}`, context.indentLevel + 1));

          if (excData.action) {
            const excContext = { ...context, indentLevel: context.indentLevel + 2 };
            for (const stmt of excData.action) {
              const stmtStr = this.deparseStmt(stmt, excContext);
              parts.push(this.indent(stmtStr + ';', excContext.indentLevel));
            }
          }
        }
      }
    }

    parts.push(kw('END'));
    if (block.label) {
      parts[parts.length - 1] += ` ${block.label}`;
    }

    return parts.join(this.options.newline);
  }

  /**
   * Deparse an assignment statement
   */
  private deparseAssign(assign: PLpgSQL_stmt_assign, context: PLpgSQLDeparserContext): string {
    const varName = this.getVarName(assign.varno, context);
    const expr = assign.expr ? this.deparseExpr(assign.expr) : '';
    
    // The expression already contains the assignment in the query
    // e.g., "sum := sum + n"
    if (expr.includes(':=')) {
      return expr;
    }
    
    return `${varName} := ${expr}`;
  }

  /**
   * Deparse an IF statement
   */
  private deparseIf(ifStmt: PLpgSQL_stmt_if, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [];

    // IF condition THEN
    const cond = ifStmt.cond ? this.deparseExpr(ifStmt.cond) : 'TRUE';
    parts.push(`${kw('IF')} ${cond} ${kw('THEN')}`);

    // THEN body
    if (ifStmt.then_body) {
      const bodyContext = { ...context, indentLevel: context.indentLevel + 1 };
      for (const stmt of ifStmt.then_body) {
        const stmtStr = this.deparseStmt(stmt, bodyContext);
        parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
      }
    }

    // ELSIF clauses
    if (ifStmt.elsif_list) {
      for (const elsif of ifStmt.elsif_list) {
        if ('PLpgSQL_if_elsif' in elsif) {
          const elsifData = elsif.PLpgSQL_if_elsif;
          const elsifCond = elsifData.cond ? this.deparseExpr(elsifData.cond) : 'TRUE';
          parts.push(`${kw('ELSIF')} ${elsifCond} ${kw('THEN')}`);

          if (elsifData.stmts) {
            const bodyContext = { ...context, indentLevel: context.indentLevel + 1 };
            for (const stmt of elsifData.stmts) {
              const stmtStr = this.deparseStmt(stmt, bodyContext);
              parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
            }
          }
        }
      }
    }

    // ELSE clause
    if (ifStmt.else_body && ifStmt.else_body.length > 0) {
      parts.push(kw('ELSE'));
      const bodyContext = { ...context, indentLevel: context.indentLevel + 1 };
      for (const stmt of ifStmt.else_body) {
        const stmtStr = this.deparseStmt(stmt, bodyContext);
        parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
      }
    }

    parts.push(kw('END IF'));

    return parts.join(this.options.newline);
  }

  /**
   * Deparse a CASE statement
   */
  private deparseCase(caseStmt: PLpgSQL_stmt_case, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [];

    // CASE expression
    if (caseStmt.t_expr) {
      parts.push(`${kw('CASE')} ${this.deparseExpr(caseStmt.t_expr)}`);
    } else {
      parts.push(kw('CASE'));
    }

    // WHEN clauses
    if (caseStmt.case_when_list) {
      for (const when of caseStmt.case_when_list) {
        if ('PLpgSQL_case_when' in when) {
          const whenData = when.PLpgSQL_case_when;
          // The expr contains the full condition like "__Case__Variable_9__" IN (0)
          // We need to extract just the value part
          let whenExpr = whenData.expr ? this.deparseExpr(whenData.expr) : '';
          // Try to extract the value from IN clause
          const inMatch = whenExpr.match(/IN \((.+)\)$/);
          if (inMatch) {
            whenExpr = inMatch[1];
          }
          parts.push(this.indent(`${kw('WHEN')} ${whenExpr} ${kw('THEN')}`, context.indentLevel + 1));

          if (whenData.stmts) {
            const bodyContext = { ...context, indentLevel: context.indentLevel + 2 };
            for (const stmt of whenData.stmts) {
              const stmtStr = this.deparseStmt(stmt, bodyContext);
              parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
            }
          }
        }
      }
    }

    // ELSE clause
    if (caseStmt.have_else && caseStmt.else_stmts) {
      parts.push(this.indent(kw('ELSE'), context.indentLevel + 1));
      const bodyContext = { ...context, indentLevel: context.indentLevel + 2 };
      for (const stmt of caseStmt.else_stmts) {
        const stmtStr = this.deparseStmt(stmt, bodyContext);
        parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
      }
    }

    parts.push(kw('END CASE'));

    return parts.join(this.options.newline);
  }

  /**
   * Deparse a simple LOOP statement
   */
  private deparseLoop(loop: PLpgSQL_stmt_loop, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [];

    if (loop.label) {
      parts.push(`<<${loop.label}>>`);
    }

    parts.push(kw('LOOP'));

    if (loop.body) {
      const bodyContext = { ...context, indentLevel: context.indentLevel + 1 };
      for (const stmt of loop.body) {
        const stmtStr = this.deparseStmt(stmt, bodyContext);
        parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
      }
    }

    parts.push(kw('END LOOP'));
    if (loop.label) {
      parts[parts.length - 1] += ` ${loop.label}`;
    }

    return parts.join(this.options.newline);
  }

  /**
   * Deparse a WHILE loop
   */
  private deparseWhile(whileStmt: PLpgSQL_stmt_while, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [];

    if (whileStmt.label) {
      parts.push(`<<${whileStmt.label}>>`);
    }

    const cond = whileStmt.cond ? this.deparseExpr(whileStmt.cond) : 'TRUE';
    parts.push(`${kw('WHILE')} ${cond} ${kw('LOOP')}`);

    if (whileStmt.body) {
      const bodyContext = { ...context, indentLevel: context.indentLevel + 1 };
      for (const stmt of whileStmt.body) {
        const stmtStr = this.deparseStmt(stmt, bodyContext);
        parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
      }
    }

    parts.push(kw('END LOOP'));
    if (whileStmt.label) {
      parts[parts.length - 1] += ` ${whileStmt.label}`;
    }

    return parts.join(this.options.newline);
  }

  /**
   * Deparse a FOR i IN ... loop (integer range)
   */
  private deparseFori(fori: PLpgSQL_stmt_fori, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [];

    if (fori.label) {
      parts.push(`<<${fori.label}>>`);
    }

    const varName = fori.var ? this.deparseDatumName(fori.var, context) : 'i';
    const lower = fori.lower ? this.deparseExpr(fori.lower) : '1';
    const upper = fori.upper ? this.deparseExpr(fori.upper) : '10';
    
    let rangeExpr = `${lower}..${upper}`;
    if (fori.step) {
      rangeExpr += ` ${kw('BY')} ${this.deparseExpr(fori.step)}`;
    }
    if (fori.reverse) {
      parts.push(`${kw('FOR')} ${varName} ${kw('IN REVERSE')} ${rangeExpr} ${kw('LOOP')}`);
    } else {
      parts.push(`${kw('FOR')} ${varName} ${kw('IN')} ${rangeExpr} ${kw('LOOP')}`);
    }

    if (fori.body) {
      const bodyContext = { ...context, indentLevel: context.indentLevel + 1 };
      for (const stmt of fori.body) {
        const stmtStr = this.deparseStmt(stmt, bodyContext);
        parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
      }
    }

    parts.push(kw('END LOOP'));
    if (fori.label) {
      parts[parts.length - 1] += ` ${fori.label}`;
    }

    return parts.join(this.options.newline);
  }

  /**
   * Deparse a FOR ... IN query loop
   */
  private deparseFors(fors: PLpgSQL_stmt_fors, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [];

    if (fors.label) {
      parts.push(`<<${fors.label}>>`);
    }

    const varName = fors.var ? this.deparseDatumName(fors.var, context) : 'rec';
    const query = fors.query ? this.deparseExpr(fors.query) : '';
    parts.push(`${kw('FOR')} ${varName} ${kw('IN')} ${query} ${kw('LOOP')}`);

    if (fors.body) {
      const bodyContext = { ...context, indentLevel: context.indentLevel + 1 };
      for (const stmt of fors.body) {
        const stmtStr = this.deparseStmt(stmt, bodyContext);
        parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
      }
    }

    parts.push(kw('END LOOP'));
    if (fors.label) {
      parts[parts.length - 1] += ` ${fors.label}`;
    }

    return parts.join(this.options.newline);
  }

  /**
   * Deparse a FOR ... IN cursor loop
   */
  private deparseForc(forc: PLpgSQL_stmt_forc, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [];

    if (forc.label) {
      parts.push(`<<${forc.label}>>`);
    }

    const varName = forc.var ? this.deparseDatumName(forc.var, context) : 'rec';
    const cursorName = this.getVarName(forc.curvar, context);
    
    let forClause = `${kw('FOR')} ${varName} ${kw('IN')} ${cursorName}`;
    if (forc.argquery) {
      forClause += `(${this.deparseExpr(forc.argquery)})`;
    }
    parts.push(`${forClause} ${kw('LOOP')}`);

    if (forc.body) {
      const bodyContext = { ...context, indentLevel: context.indentLevel + 1 };
      for (const stmt of forc.body) {
        const stmtStr = this.deparseStmt(stmt, bodyContext);
        parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
      }
    }

    parts.push(kw('END LOOP'));
    if (forc.label) {
      parts[parts.length - 1] += ` ${forc.label}`;
    }

    return parts.join(this.options.newline);
  }

  /**
   * Deparse a FOREACH loop
   */
  private deparseForeach(foreach: PLpgSQL_stmt_foreach_a, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [];

    if (foreach.label) {
      parts.push(`<<${foreach.label}>>`);
    }

    const varName = this.getVarName(foreach.varno, context);
    const expr = foreach.expr ? this.deparseExpr(foreach.expr) : '';
    
    let sliceClause = '';
    if (foreach.slice && foreach.slice > 0) {
      sliceClause = ` ${kw('SLICE')} ${foreach.slice}`;
    }
    
    parts.push(`${kw('FOREACH')} ${varName}${sliceClause} ${kw('IN ARRAY')} ${expr} ${kw('LOOP')}`);

    if (foreach.body) {
      const bodyContext = { ...context, indentLevel: context.indentLevel + 1 };
      for (const stmt of foreach.body) {
        const stmtStr = this.deparseStmt(stmt, bodyContext);
        parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
      }
    }

    parts.push(kw('END LOOP'));
    if (foreach.label) {
      parts[parts.length - 1] += ` ${foreach.label}`;
    }

    return parts.join(this.options.newline);
  }

  /**
   * Deparse an EXIT or CONTINUE statement
   */
  private deparseExit(exit: PLpgSQL_stmt_exit, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [];

    if (exit.is_exit) {
      parts.push(kw('EXIT'));
    } else {
      parts.push(kw('CONTINUE'));
    }

    if (exit.label) {
      parts.push(exit.label);
    }

    if (exit.cond) {
      parts.push(kw('WHEN'));
      parts.push(this.deparseExpr(exit.cond));
    }

    return parts.join(' ');
  }

  /**
   * Deparse a RETURN statement
   * 
   * PostgreSQL requires different RETURN syntax based on function type:
   * - void/setof/trigger/out_params: bare RETURN is valid
   * - scalar: RETURN NULL is required for empty returns
   * 
   * When returnInfo is provided in context, we use it to determine the correct syntax.
   * When not provided, we fall back to heuristics that scan the function body.
   */
  private deparseReturn(ret: PLpgSQL_stmt_return, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    
    if (ret.expr) {
      return `${kw('RETURN')} ${this.deparseExpr(ret.expr)}`;
    }
    
    if (ret.retvarno !== undefined && ret.retvarno >= 0) {
      const varName = this.getVarName(ret.retvarno, context);
      return `${kw('RETURN')} ${varName}`;
    }
    
    // Empty RETURN - need to determine if we should output bare RETURN or RETURN NULL
    // Use context.returnInfo if available, otherwise use heuristics
    if (context.returnInfo) {
      // Context-based: use the provided return type info
      if (context.returnInfo.kind === 'scalar') {
        return `${kw('RETURN')} ${kw('NULL')}`;
      }
      // void, setof, trigger, out_params all use bare RETURN
      return kw('RETURN');
    }
    
    // Heuristic fallback: bare RETURN is the safest default
    // This maintains backward compatibility for callers that don't provide returnInfo
    return kw('RETURN');
  }

  /**
   * Deparse a RETURN NEXT statement
   */
  private deparseReturnNext(ret: PLpgSQL_stmt_return_next, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    
    if (ret.expr) {
      return `${kw('RETURN NEXT')} ${this.deparseExpr(ret.expr)}`;
    }
    
    if (ret.retvarno !== undefined && ret.retvarno >= 0) {
      const varName = this.getVarName(ret.retvarno, context);
      return `${kw('RETURN NEXT')} ${varName}`;
    }
    
    return kw('RETURN NEXT');
  }

  /**
   * Deparse a RETURN QUERY statement
   */
  private deparseReturnQuery(ret: PLpgSQL_stmt_return_query, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    
    if (ret.query) {
      return `${kw('RETURN QUERY')} ${this.deparseExpr(ret.query)}`;
    }
    
    if (ret.dynquery) {
      let result = `${kw('RETURN QUERY EXECUTE')} ${this.deparseExpr(ret.dynquery)}`;
      if (ret.params && ret.params.length > 0) {
        const params = ret.params.map(p => this.deparseExpr(p)).join(', ');
        result += ` ${kw('USING')} ${params}`;
      }
      return result;
    }
    
    return kw('RETURN QUERY');
  }

  /**
   * Deparse a RAISE statement
   */
  private deparseRaise(raise: PLpgSQL_stmt_raise, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [kw('RAISE')];

    // Log level
    const level = this.getElogLevelName(raise.elog_level);
    if (level) {
      parts.push(level);
    }

    // Condition name (for RAISE without message)
    if (raise.condname) {
      parts.push(raise.condname);
    }

    // Message
    if (raise.message) {
      parts.push(`'${raise.message.replace(/'/g, "''")}'`);
      
      // Parameters
      if (raise.params && raise.params.length > 0) {
        const params = raise.params.map(p => this.deparseExpr(p)).join(', ');
        parts[parts.length - 1] += `, ${params}`;
      }
    }

    // Options (USING clause)
    if (raise.options && raise.options.length > 0) {
      const optionStrs: string[] = [];
      for (const opt of raise.options) {
        if ('PLpgSQL_raise_option' in opt) {
          const optData = opt.PLpgSQL_raise_option;
          const optName = this.getRaiseOptionName(optData.opt_type);
          const optExpr = optData.expr ? this.deparseExpr(optData.expr) : '';
          optionStrs.push(`${optName} = ${optExpr}`);
        }
      }
      if (optionStrs.length > 0) {
        parts.push(kw('USING'));
        parts.push(optionStrs.join(', '));
      }
    }

    return parts.join(' ');
  }

  /**
   * Deparse an ASSERT statement
   */
  private deparseAssert(assert: PLpgSQL_stmt_assert, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const cond = assert.cond ? this.deparseExpr(assert.cond) : 'TRUE';
    
    if (assert.message) {
      return `${kw('ASSERT')} ${cond}, ${this.deparseExpr(assert.message)}`;
    }
    
    return `${kw('ASSERT')} ${cond}`;
  }

  /**
   * Deparse an EXECUTE SQL statement
   */
  private deparseExecSql(exec: PLpgSQL_stmt_execsql, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    let sql = exec.sqlstmt ? this.deparseExpr(exec.sqlstmt) : '';
    
    if (exec.into && exec.target !== undefined) {
      // exec.target is a PLpgSQLDatum object (e.g., {PLpgSQL_recfield: {...}})
      const targetName = this.deparseDatumName(exec.target, context);
      const strict = exec.strict ? kw('STRICT') + ' ' : '';
      const intoClause = ` ${kw('INTO')} ${strict}${targetName}`;
      // Use depth-aware scanner to find the correct insertion point
      // Only insert INTO at depth 0 (not inside subqueries)
      const insertPos = this.findIntoInsertionPoint(sql);
      if (insertPos !== -1) {
        // The parser strips "INTO <target>" from the query but leaves whitespace behind.
        // We need to normalize the leading whitespace after the insertion point to avoid
        // large gaps like "SELECT x INTO y                    FROM z"
        const before = sql.slice(0, insertPos);
        let after = sql.slice(insertPos);
        // Collapse leading whitespace (but preserve a single space before the next keyword)
        after = after.replace(/^[ \t]+/, ' ');
        sql = before + intoClause + after;
      } else {
        // -1 means INTO already exists at depth 0, don't add another one
        // (this shouldn't happen in practice since the parser strips INTO)
      }
    }
    
    return sql;
  }

  /**
   * Find the correct position to insert INTO clause in a SQL statement.
   * Uses a depth-aware scanner to avoid inserting inside subqueries.
   * Returns the position to insert INTO, or -1 if INTO already exists at depth 0.
   */
  private findIntoInsertionPoint(sql: string): number {
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inDollarQuote = false;
    let dollarQuoteTag = '';
    let inLineComment = false;
    let inBlockComment = false;
    const upperSql = sql.toUpperCase();
    const len = sql.length;
    
    // Clause keywords that end the SELECT target list at depth 0
    const clauseKeywords = ['FROM', 'WHERE', 'GROUP', 'HAVING', 'WINDOW', 'ORDER', 'LIMIT', 'OFFSET', 'FETCH', 'FOR', 'UNION', 'INTERSECT', 'EXCEPT'];
    
    for (let i = 0; i < len; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1] || '';
      
      // Handle line comments
      if (!inSingleQuote && !inDoubleQuote && !inDollarQuote && !inBlockComment) {
        if (char === '-' && nextChar === '-') {
          inLineComment = true;
          i++;
          continue;
        }
      }
      if (inLineComment) {
        if (char === '\n') {
          inLineComment = false;
        }
        continue;
      }
      
      // Handle block comments
      if (!inSingleQuote && !inDoubleQuote && !inDollarQuote && !inLineComment) {
        if (char === '/' && nextChar === '*') {
          inBlockComment = true;
          i++;
          continue;
        }
      }
      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }
      
      // Handle dollar quotes
      if (!inSingleQuote && !inDoubleQuote && !inBlockComment && !inLineComment) {
        if (char === '$') {
          let tagEnd = i + 1;
          while (tagEnd < len && (/[a-zA-Z0-9_]/.test(sql[tagEnd]) || sql[tagEnd] === '$')) {
            if (sql[tagEnd] === '$') {
              tagEnd++;
              break;
            }
            tagEnd++;
          }
          const tag = sql.slice(i, tagEnd);
          if (tag.endsWith('$')) {
            if (inDollarQuote && tag === dollarQuoteTag) {
              inDollarQuote = false;
              dollarQuoteTag = '';
              i = tagEnd - 1;
              continue;
            } else if (!inDollarQuote) {
              inDollarQuote = true;
              dollarQuoteTag = tag;
              i = tagEnd - 1;
              continue;
            }
          }
        }
      }
      if (inDollarQuote) {
        continue;
      }
      
      // Handle single quotes
      if (!inDoubleQuote && !inBlockComment && !inLineComment && !inDollarQuote) {
        if (char === "'") {
          if (inSingleQuote && nextChar === "'") {
            i++;
            continue;
          }
          inSingleQuote = !inSingleQuote;
          continue;
        }
      }
      if (inSingleQuote) {
        continue;
      }
      
      // Handle double quotes (identifiers)
      if (!inSingleQuote && !inBlockComment && !inLineComment && !inDollarQuote) {
        if (char === '"') {
          if (inDoubleQuote && nextChar === '"') {
            i++;
            continue;
          }
          inDoubleQuote = !inDoubleQuote;
          continue;
        }
      }
      if (inDoubleQuote) {
        continue;
      }
      
      // Track parentheses depth
      if (char === '(') {
        depth++;
        continue;
      }
      if (char === ')') {
        depth--;
        continue;
      }
      
      // Only look for keywords at depth 0
      if (depth === 0) {
        // Check if we're at a word boundary before checking keywords
        const prevChar = i > 0 ? sql[i - 1] : ' ';
        const isWordBoundary = /\s/.test(prevChar) || prevChar === '(' || prevChar === ')' || prevChar === ',' || i === 0;
        
        if (isWordBoundary) {
          // Check if INTO already exists at depth 0
          if (/^INTO\s/i.test(upperSql.slice(i))) {
            return -1;
          }
          
          // Check for clause keywords that end the target list
          for (const keyword of clauseKeywords) {
            const pattern = new RegExp(`^${keyword}\\b`, 'i');
            if (pattern.test(upperSql.slice(i))) {
              let insertPos = i;
              while (insertPos > 0 && /\s/.test(sql[insertPos - 1])) {
                insertPos--;
              }
              return insertPos;
            }
          }
        }
      }
    }
    
    // No clause keyword found - append at end
    let insertPos = len;
    while (insertPos > 0 && /\s/.test(sql[insertPos - 1])) {
      insertPos--;
    }
    return insertPos;
  }

  /**
   * Deparse a dynamic EXECUTE statement
   */
  private deparseDynExecute(exec: PLpgSQL_stmt_dynexecute, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [kw('EXECUTE')];
    
    if (exec.query) {
      parts.push(this.deparseExpr(exec.query));
    }
    
    if (exec.into && exec.target) {
      const strict = exec.strict ? kw('STRICT') + ' ' : '';
      parts.push(`${kw('INTO')} ${strict}${this.deparseDatumName(exec.target, context)}`);
    }
    
    if (exec.params && exec.params.length > 0) {
      const params = exec.params.map(p => this.deparseExpr(p)).join(', ');
      parts.push(`${kw('USING')} ${params}`);
    }
    
    return parts.join(' ');
  }

  /**
   * Deparse a dynamic FOR loop
   */
  private deparseDynFors(fors: PLpgSQL_stmt_dynfors, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [];

    if (fors.label) {
      parts.push(`<<${fors.label}>>`);
    }

    const varName = fors.var ? this.deparseDatumName(fors.var, context) : 'rec';
    let forClause = `${kw('FOR')} ${varName} ${kw('IN EXECUTE')} ${fors.query ? this.deparseExpr(fors.query) : ''}`;
    
    if (fors.params && fors.params.length > 0) {
      const params = fors.params.map(p => this.deparseExpr(p)).join(', ');
      forClause += ` ${kw('USING')} ${params}`;
    }
    
    parts.push(`${forClause} ${kw('LOOP')}`);

    if (fors.body) {
      const bodyContext = { ...context, indentLevel: context.indentLevel + 1 };
      for (const stmt of fors.body) {
        const stmtStr = this.deparseStmt(stmt, bodyContext);
        parts.push(this.indent(stmtStr + ';', bodyContext.indentLevel));
      }
    }

    parts.push(kw('END LOOP'));
    if (fors.label) {
      parts[parts.length - 1] += ` ${fors.label}`;
    }

    return parts.join(this.options.newline);
  }

  /**
   * Deparse a GET DIAGNOSTICS statement
   */
  private deparseGetDiag(getDiag: PLpgSQL_stmt_getdiag, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [kw('GET')];
    
    if (getDiag.is_stacked) {
      parts.push(kw('STACKED'));
    }
    
    parts.push(kw('DIAGNOSTICS'));
    
    if (getDiag.diag_items && getDiag.diag_items.length > 0) {
      const items = getDiag.diag_items.map(item => {
        if ('PLpgSQL_diag_item' in item) {
          const itemData = item.PLpgSQL_diag_item;
          const targetName = this.getVarName(itemData.target, context);
          const kindName = this.getDiagItemKindName(itemData.kind);
          return `${targetName} = ${kindName}`;
        }
        return '';
      }).filter(s => s).join(', ');
      parts.push(items);
    }
    
    return parts.join(' ');
  }

  /**
   * Deparse an OPEN cursor statement
   */
  private deparseOpen(open: PLpgSQL_stmt_open, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const cursorName = this.getVarName(open.curvar, context);
    const parts: string[] = [kw('OPEN'), cursorName];
    
    if (open.argquery) {
      parts.push(`(${this.deparseExpr(open.argquery)})`);
    }
    
    if (open.query) {
      parts.push(kw('FOR'));
      parts.push(this.deparseExpr(open.query));
    } else if (open.dynquery) {
      parts.push(kw('FOR EXECUTE'));
      parts.push(this.deparseExpr(open.dynquery));
      
      if (open.params && open.params.length > 0) {
        const params = open.params.map(p => this.deparseExpr(p)).join(', ');
        parts.push(`${kw('USING')} ${params}`);
      }
    }
    
    // Handle SCROLL option
    if (open.cursor_options) {
      if (open.cursor_options & 256) { // CURSOR_OPT_SCROLL
        parts.splice(1, 0, kw('SCROLL'));
      } else if (open.cursor_options & 512) { // CURSOR_OPT_NO_SCROLL
        parts.splice(1, 0, kw('NO SCROLL'));
      }
    }
    
    return parts.join(' ');
  }

  /**
   * Deparse a FETCH statement
   */
  private deparseFetch(fetch: PLpgSQL_stmt_fetch, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const parts: string[] = [];
    
    if (fetch.is_move) {
      parts.push(kw('MOVE'));
    } else {
      parts.push(kw('FETCH'));
    }
    
    // Direction
    const direction = this.getFetchDirectionName(fetch.direction, fetch.how_many, fetch.expr);
    if (direction) {
      parts.push(direction);
    }
    
    // Cursor
    const cursorName = this.getVarName(fetch.curvar, context);
    parts.push(`${kw('FROM')} ${cursorName}`);
    
    // INTO target
    if (!fetch.is_move && fetch.target) {
      parts.push(`${kw('INTO')} ${this.deparseDatumName(fetch.target, context)}`);
    }
    
    return parts.join(' ');
  }

  /**
   * Deparse a CLOSE cursor statement
   */
  private deparseClose(close: PLpgSQL_stmt_close, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    const cursorName = this.getVarName(close.curvar, context);
    return `${kw('CLOSE')} ${cursorName}`;
  }

  /**
   * Deparse a PERFORM statement
   * 
   * PERFORM in PL/pgSQL is equivalent to SELECT but discards results.
   * The parser stores the query as "SELECT ...", so we need to strip the SELECT keyword.
   */
  private deparsePerform(perform: PLpgSQL_stmt_perform, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    let expr = perform.expr ? this.deparseExpr(perform.expr) : '';
    // Strip leading SELECT keyword since PERFORM replaces it
    expr = expr.replace(/^\s*SELECT\s+/i, '');
    return `${kw('PERFORM')} ${expr}`;
  }

  /**
   * Deparse a CALL statement
   */
  private deparseCall(call: PLpgSQL_stmt_call, context: PLpgSQLDeparserContext): string {
    const expr = call.expr ? this.deparseExpr(call.expr) : '';
    
    // The expression already contains the CALL keyword from the parser
    // so we just return the expression as-is
    return expr;
  }

  /**
   * Deparse a COMMIT statement
   */
  private deparseCommit(commit: PLpgSQL_stmt_commit, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    if (commit.chain) {
      return `${kw('COMMIT AND CHAIN')}`;
    }
    return kw('COMMIT');
  }

  /**
   * Deparse a ROLLBACK statement
   */
  private deparseRollback(rollback: PLpgSQL_stmt_rollback, context: PLpgSQLDeparserContext): string {
    const kw = this.keyword;
    if (rollback.chain) {
      return `${kw('ROLLBACK AND CHAIN')}`;
    }
    return kw('ROLLBACK');
  }

  /**
   * Deparse a SET statement
   */
  private deparseSet(set: PLpgSQL_stmt_set, context: PLpgSQLDeparserContext): string {
    const expr = set.expr ? this.deparseExpr(set.expr) : '';
    return expr;
  }

  // Helper methods

  /**
   * Get variable name by varno from datums
   */
  private getVarName(varno: number | undefined, context: PLpgSQLDeparserContext): string {
    if (varno === undefined || varno < 0 || !context.datums) {
      return `$${varno ?? 0}`;
    }
    
    const datum = context.datums[varno];
    if (!datum) {
      return `$${varno}`;
    }
    
    return this.deparseDatumName(datum, context);
  }

  /**
   * Get the name from a datum
   * For PLpgSQL_row with refname "(unnamed row)", expand the fields array
   * to get the actual variable names.
   * For PLpgSQL_recfield, construct the full qualified reference (e.g., new.is_active)
   * by looking up the parent record name.
   */
  private deparseDatumName(datum: PLpgSQLDatum, context?: PLpgSQLDeparserContext): string {
    if ('PLpgSQL_var' in datum) {
      return datum.PLpgSQL_var.refname;
    }
    if ('PLpgSQL_rec' in datum) {
      return datum.PLpgSQL_rec.refname;
    }
    if ('PLpgSQL_row' in datum) {
      const row = datum.PLpgSQL_row;
      // If this is an "(unnamed row)" with fields, expand the fields to get actual variable names
      if (row.refname === '(unnamed row)' && row.fields && row.fields.length > 0 && context?.datums) {
        const fieldNames = row.fields.map(field => {
          // Try to resolve the varno to get the actual variable name
          const fieldDatum = context.datums[field.varno];
          if (fieldDatum) {
            // Recursively get the name, passing context to resolve parent records
            return this.deparseDatumName(fieldDatum, context);
          }
          // Fall back to the field name if we can't resolve the varno
          return field.name;
        });
        return fieldNames.join(', ');
      }
      return row.refname;
    }
    if ('PLpgSQL_recfield' in datum) {
      const recfield = datum.PLpgSQL_recfield;
      // Get the parent record name to construct the full field reference (e.g., new.is_active)
      if (recfield.recparentno !== undefined && context?.datums) {
        const parentDatum = context.datums[recfield.recparentno];
        if (parentDatum) {
          const parentName = this.deparseDatumName(parentDatum);
          if (parentName) {
            return `${parentName}.${recfield.fieldname}`;
          }
        }
      }
      return recfield.fieldname;
    }
    return '';
  }

  /**
   * Get the elog level name
   */
  private getElogLevelName(level: number | undefined): string {
    if (level === undefined) return '';
    
    switch (level) {
      case ElogLevel.DEBUG5:
      case ElogLevel.DEBUG4:
      case ElogLevel.DEBUG3:
      case ElogLevel.DEBUG2:
      case ElogLevel.DEBUG1:
        return this.keyword('DEBUG');
      case ElogLevel.LOG:
      case ElogLevel.LOG_SERVER_ONLY:
        return this.keyword('LOG');
      case ElogLevel.INFO:
        return this.keyword('INFO');
      case ElogLevel.NOTICE:
        return this.keyword('NOTICE');
      case ElogLevel.WARNING:
      case ElogLevel.WARNING_CLIENT_ONLY:
        return this.keyword('WARNING');
      case ElogLevel.ERROR:
        return this.keyword('EXCEPTION');
      case ElogLevel.FATAL:
      case ElogLevel.PANIC:
        return this.keyword('EXCEPTION');
      default:
        return '';
    }
  }

  /**
   * Get the raise option name
   */
  private getRaiseOptionName(optType: number | undefined): string {
    if (optType === undefined) return '';
    
    switch (optType) {
      case RaiseOptionType.PLPGSQL_RAISEOPTION_ERRCODE:
        return this.keyword('ERRCODE');
      case RaiseOptionType.PLPGSQL_RAISEOPTION_MESSAGE:
        return this.keyword('MESSAGE');
      case RaiseOptionType.PLPGSQL_RAISEOPTION_DETAIL:
        return this.keyword('DETAIL');
      case RaiseOptionType.PLPGSQL_RAISEOPTION_HINT:
        return this.keyword('HINT');
      case RaiseOptionType.PLPGSQL_RAISEOPTION_COLUMN:
        return this.keyword('COLUMN');
      case RaiseOptionType.PLPGSQL_RAISEOPTION_CONSTRAINT:
        return this.keyword('CONSTRAINT');
      case RaiseOptionType.PLPGSQL_RAISEOPTION_DATATYPE:
        return this.keyword('DATATYPE');
      case RaiseOptionType.PLPGSQL_RAISEOPTION_TABLE:
        return this.keyword('TABLE');
      case RaiseOptionType.PLPGSQL_RAISEOPTION_SCHEMA:
        return this.keyword('SCHEMA');
      default:
        return '';
    }
  }

  /**
   * Get the diagnostic item kind name
   */
  private getDiagItemKindName(kind: number | undefined): string {
    if (kind === undefined) return '';
    
    switch (kind) {
      case DiagItemKind.PLPGSQL_GETDIAG_ROW_COUNT:
        return this.keyword('ROW_COUNT');
      case DiagItemKind.PLPGSQL_GETDIAG_CONTEXT:
        return this.keyword('PG_CONTEXT');
      case DiagItemKind.PLPGSQL_GETDIAG_ERROR_CONTEXT:
        return this.keyword('PG_EXCEPTION_CONTEXT');
      case DiagItemKind.PLPGSQL_GETDIAG_ERROR_DETAIL:
        return this.keyword('PG_EXCEPTION_DETAIL');
      case DiagItemKind.PLPGSQL_GETDIAG_ERROR_HINT:
        return this.keyword('PG_EXCEPTION_HINT');
      case DiagItemKind.PLPGSQL_GETDIAG_RETURNED_SQLSTATE:
        return this.keyword('RETURNED_SQLSTATE');
      case DiagItemKind.PLPGSQL_GETDIAG_COLUMN_NAME:
        return this.keyword('COLUMN_NAME');
      case DiagItemKind.PLPGSQL_GETDIAG_CONSTRAINT_NAME:
        return this.keyword('CONSTRAINT_NAME');
      case DiagItemKind.PLPGSQL_GETDIAG_DATATYPE_NAME:
        return this.keyword('PG_DATATYPE_NAME');
      case DiagItemKind.PLPGSQL_GETDIAG_MESSAGE_TEXT:
        return this.keyword('MESSAGE_TEXT');
      case DiagItemKind.PLPGSQL_GETDIAG_TABLE_NAME:
        return this.keyword('TABLE_NAME');
      case DiagItemKind.PLPGSQL_GETDIAG_SCHEMA_NAME:
        return this.keyword('SCHEMA_NAME');
      default:
        return '';
    }
  }

  /**
   * Get the fetch direction name
   */
  private getFetchDirectionName(
    direction: number | undefined,
    howMany: number | undefined,
    expr: PLpgSQLExprNode | undefined
  ): string {
    if (direction === undefined) return '';
    
    switch (direction) {
      case FetchDirection.FETCH_FORWARD:
        if (howMany === 1) return '';
        if (howMany === 0) return this.keyword('ALL');
        return `${this.keyword('FORWARD')} ${howMany}`;
      case FetchDirection.FETCH_BACKWARD:
        if (howMany === 1) return this.keyword('PRIOR');
        if (howMany === 0) return `${this.keyword('BACKWARD')} ${this.keyword('ALL')}`;
        return `${this.keyword('BACKWARD')} ${howMany}`;
      case FetchDirection.FETCH_ABSOLUTE:
        if (expr) {
          return `${this.keyword('ABSOLUTE')} ${this.deparseExpr(expr)}`;
        }
        return `${this.keyword('ABSOLUTE')} ${howMany}`;
      case FetchDirection.FETCH_RELATIVE:
        if (expr) {
          return `${this.keyword('RELATIVE')} ${this.deparseExpr(expr)}`;
        }
        return `${this.keyword('RELATIVE')} ${howMany}`;
      default:
        return '';
    }
  }

  /**
   * Apply indentation to all lines of text
   * This ensures proper formatting for multi-line statements (nested IF/WHILE/LOOP blocks)
   */
  private indent(text: string, level: number): string {
    const indent = this.options.indent!.repeat(level);
    return indent + text.replace(/\n/g, '\n' + indent);
  }

  /**
   * Convert keyword to proper case
   */
  private keyword = (kw: string): string => {
    return this.options.uppercase ? kw.toUpperCase() : kw.toLowerCase();
  };
}
