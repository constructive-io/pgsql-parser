/**
 * PL/pgSQL AST Types
 * 
 * These types represent the AST structure returned by parsePlPgSQL from libpg-query.
 * The AST is different from the regular SQL AST and represents the internal
 * structure of PL/pgSQL functions.
 */

export interface PLpgSQLParseResult {
  plpgsql_funcs: PLpgSQLFunctionNode[];
}

export type PLpgSQLFunctionNode = {
  PLpgSQL_function: PLpgSQL_function;
};

export interface PLpgSQL_function {
  datums?: PLpgSQLDatum[];
  action?: PLpgSQLStmtNode;
}

export type PLpgSQLDatum = 
  | { PLpgSQL_var: PLpgSQL_var }
  | { PLpgSQL_rec: PLpgSQL_rec }
  | { PLpgSQL_row: PLpgSQL_row }
  | { PLpgSQL_recfield: PLpgSQL_recfield };

export interface PLpgSQL_var {
  refname: string;
  lineno?: number;
  datatype?: PLpgSQLTypeNode;
  default_val?: PLpgSQLExprNode;
  isconst?: boolean;
  notnull?: boolean;
  cursor_explicit_expr?: PLpgSQLExprNode;
  cursor_explicit_argrow?: number;
  cursor_options?: number;
}

export interface PLpgSQL_rec {
  refname: string;
  dno?: number;
  lineno?: number;
}

export interface PLpgSQL_row {
  refname: string;
  lineno?: number;
  fields?: PLpgSQLRowField[];
}

export interface PLpgSQLRowField {
  name: string;
  varno: number;
}

export interface PLpgSQL_recfield {
  fieldname: string;
  recparentno?: number;
}

export type PLpgSQLTypeNode = {
  PLpgSQL_type: PLpgSQL_type;
};

export interface PLpgSQL_type {
  typname: string;
}

export type PLpgSQLExprNode = {
  PLpgSQL_expr: PLpgSQL_expr;
};

export interface PLpgSQL_expr {
  query: string;
  parseMode?: number;
}

// Statement types
export type PLpgSQLStmtNode =
  | { PLpgSQL_stmt_block: PLpgSQL_stmt_block }
  | { PLpgSQL_stmt_assign: PLpgSQL_stmt_assign }
  | { PLpgSQL_stmt_if: PLpgSQL_stmt_if }
  | { PLpgSQL_stmt_case: PLpgSQL_stmt_case }
  | { PLpgSQL_stmt_loop: PLpgSQL_stmt_loop }
  | { PLpgSQL_stmt_while: PLpgSQL_stmt_while }
  | { PLpgSQL_stmt_fori: PLpgSQL_stmt_fori }
  | { PLpgSQL_stmt_fors: PLpgSQL_stmt_fors }
  | { PLpgSQL_stmt_forc: PLpgSQL_stmt_forc }
  | { PLpgSQL_stmt_foreach_a: PLpgSQL_stmt_foreach_a }
  | { PLpgSQL_stmt_exit: PLpgSQL_stmt_exit }
  | { PLpgSQL_stmt_return: PLpgSQL_stmt_return }
  | { PLpgSQL_stmt_return_next: PLpgSQL_stmt_return_next }
  | { PLpgSQL_stmt_return_query: PLpgSQL_stmt_return_query }
  | { PLpgSQL_stmt_raise: PLpgSQL_stmt_raise }
  | { PLpgSQL_stmt_assert: PLpgSQL_stmt_assert }
  | { PLpgSQL_stmt_execsql: PLpgSQL_stmt_execsql }
  | { PLpgSQL_stmt_dynexecute: PLpgSQL_stmt_dynexecute }
  | { PLpgSQL_stmt_dynfors: PLpgSQL_stmt_dynfors }
  | { PLpgSQL_stmt_getdiag: PLpgSQL_stmt_getdiag }
  | { PLpgSQL_stmt_open: PLpgSQL_stmt_open }
  | { PLpgSQL_stmt_fetch: PLpgSQL_stmt_fetch }
  | { PLpgSQL_stmt_close: PLpgSQL_stmt_close }
  | { PLpgSQL_stmt_perform: PLpgSQL_stmt_perform }
  | { PLpgSQL_stmt_call: PLpgSQL_stmt_call }
  | { PLpgSQL_stmt_commit: PLpgSQL_stmt_commit }
  | { PLpgSQL_stmt_rollback: PLpgSQL_stmt_rollback }
  | { PLpgSQL_stmt_set: PLpgSQL_stmt_set };

export interface PLpgSQL_stmt_block {
  lineno?: number;
  label?: string;
  body?: PLpgSQLStmtNode[];
  exceptions?: PLpgSQLExceptionBlock;
}

export interface PLpgSQLExceptionBlock {
  exc_list?: PLpgSQLException[];
}

export interface PLpgSQLException {
  PLpgSQL_exception: {
    lineno?: number;
    conditions?: PLpgSQLCondition[];
    action?: PLpgSQLStmtNode[];
  };
}

export interface PLpgSQLCondition {
  PLpgSQL_condition: {
    condname?: string;
    sqlerrstate?: string;
  };
}

export interface PLpgSQL_stmt_assign {
  lineno?: number;
  varno?: number;
  expr?: PLpgSQLExprNode;
}

export interface PLpgSQL_stmt_if {
  lineno?: number;
  cond?: PLpgSQLExprNode;
  then_body?: PLpgSQLStmtNode[];
  elsif_list?: PLpgSQLElsifNode[];
  else_body?: PLpgSQLStmtNode[];
}

export type PLpgSQLElsifNode = {
  PLpgSQL_if_elsif: PLpgSQL_if_elsif;
};

export interface PLpgSQL_if_elsif {
  lineno?: number;
  cond?: PLpgSQLExprNode;
  stmts?: PLpgSQLStmtNode[];
}

export interface PLpgSQL_stmt_case {
  lineno?: number;
  t_expr?: PLpgSQLExprNode;
  t_varno?: number;
  case_when_list?: PLpgSQLCaseWhenNode[];
  have_else?: boolean;
  else_stmts?: PLpgSQLStmtNode[];
}

export type PLpgSQLCaseWhenNode = {
  PLpgSQL_case_when: PLpgSQL_case_when;
};

export interface PLpgSQL_case_when {
  lineno?: number;
  expr?: PLpgSQLExprNode;
  stmts?: PLpgSQLStmtNode[];
}

export interface PLpgSQL_stmt_loop {
  lineno?: number;
  label?: string;
  body?: PLpgSQLStmtNode[];
}

export interface PLpgSQL_stmt_while {
  lineno?: number;
  label?: string;
  cond?: PLpgSQLExprNode;
  body?: PLpgSQLStmtNode[];
}

export interface PLpgSQL_stmt_fori {
  lineno?: number;
  label?: string;
  var?: PLpgSQLDatum;
  lower?: PLpgSQLExprNode;
  upper?: PLpgSQLExprNode;
  step?: PLpgSQLExprNode;
  reverse?: boolean;
  body?: PLpgSQLStmtNode[];
}

export interface PLpgSQL_stmt_fors {
  lineno?: number;
  label?: string;
  var?: PLpgSQLDatum;
  query?: PLpgSQLExprNode;
  body?: PLpgSQLStmtNode[];
}

export interface PLpgSQL_stmt_forc {
  lineno?: number;
  label?: string;
  var?: PLpgSQLDatum;
  curvar?: number;
  argquery?: PLpgSQLExprNode;
  body?: PLpgSQLStmtNode[];
}

export interface PLpgSQL_stmt_foreach_a {
  lineno?: number;
  label?: string;
  varno?: number;
  slice?: number;
  expr?: PLpgSQLExprNode;
  body?: PLpgSQLStmtNode[];
}

export interface PLpgSQL_stmt_exit {
  lineno?: number;
  is_exit?: boolean;
  label?: string;
  cond?: PLpgSQLExprNode;
}

export interface PLpgSQL_stmt_return {
  lineno?: number;
  expr?: PLpgSQLExprNode;
  retvarno?: number;
}

export interface PLpgSQL_stmt_return_next {
  lineno?: number;
  expr?: PLpgSQLExprNode;
  retvarno?: number;
}

export interface PLpgSQL_stmt_return_query {
  lineno?: number;
  query?: PLpgSQLExprNode;
  dynquery?: PLpgSQLExprNode;
  params?: PLpgSQLExprNode[];
}

export interface PLpgSQL_stmt_raise {
  lineno?: number;
  elog_level?: number;
  condname?: string;
  message?: string;
  params?: PLpgSQLExprNode[];
  options?: PLpgSQLRaiseOption[];
}

export interface PLpgSQLRaiseOption {
  PLpgSQL_raise_option: {
    opt_type?: number;
    expr?: PLpgSQLExprNode;
  };
}

export interface PLpgSQL_stmt_assert {
  lineno?: number;
  cond?: PLpgSQLExprNode;
  message?: PLpgSQLExprNode;
}

export interface PLpgSQL_stmt_execsql {
  lineno?: number;
  sqlstmt?: PLpgSQLExprNode;
  into?: boolean;
  strict?: boolean;
  target?: PLpgSQLDatum;
}

export interface PLpgSQL_stmt_dynexecute {
  lineno?: number;
  query?: PLpgSQLExprNode;
  into?: boolean;
  strict?: boolean;
  target?: PLpgSQLDatum;
  params?: PLpgSQLExprNode[];
}

export interface PLpgSQL_stmt_dynfors {
  lineno?: number;
  label?: string;
  var?: PLpgSQLDatum;
  query?: PLpgSQLExprNode;
  params?: PLpgSQLExprNode[];
  body?: PLpgSQLStmtNode[];
}

export interface PLpgSQL_stmt_getdiag {
  lineno?: number;
  is_stacked?: boolean;
  diag_items?: PLpgSQLDiagItem[];
}

export interface PLpgSQLDiagItem {
  PLpgSQL_diag_item: {
    kind?: number;
    target?: number;
  };
}

export interface PLpgSQL_stmt_open {
  lineno?: number;
  curvar?: number;
  cursor_options?: number;
  argquery?: PLpgSQLExprNode;
  query?: PLpgSQLExprNode;
  dynquery?: PLpgSQLExprNode;
  params?: PLpgSQLExprNode[];
}

export interface PLpgSQL_stmt_fetch {
  lineno?: number;
  target?: PLpgSQLDatum;
  curvar?: number;
  direction?: number;
  how_many?: number;
  expr?: PLpgSQLExprNode;
  is_move?: boolean;
  returns_multiple_rows?: boolean;
}

export interface PLpgSQL_stmt_close {
  lineno?: number;
  curvar?: number;
}

export interface PLpgSQL_stmt_perform {
  lineno?: number;
  expr?: PLpgSQLExprNode;
}

export interface PLpgSQL_stmt_call {
  lineno?: number;
  expr?: PLpgSQLExprNode;
  is_call?: boolean;
  target?: PLpgSQLDatum;
}

export interface PLpgSQL_stmt_commit {
  lineno?: number;
  chain?: boolean;
}

export interface PLpgSQL_stmt_rollback {
  lineno?: number;
  chain?: boolean;
}

export interface PLpgSQL_stmt_set {
  lineno?: number;
  expr?: PLpgSQLExprNode;
}

// Elog levels for RAISE statements
export enum ElogLevel {
  DEBUG5 = 10,
  DEBUG4 = 11,
  DEBUG3 = 12,
  DEBUG2 = 13,
  DEBUG1 = 14,
  LOG = 15,
  LOG_SERVER_ONLY = 16,
  INFO = 17,
  NOTICE = 18,
  WARNING = 19,
  WARNING_CLIENT_ONLY = 20,
  ERROR = 21,
  FATAL = 22,
  PANIC = 23,
}

// Fetch direction constants
export enum FetchDirection {
  FETCH_FORWARD = 0,
  FETCH_BACKWARD = 1,
  FETCH_ABSOLUTE = 2,
  FETCH_RELATIVE = 3,
}

// Diagnostic item kinds
export enum DiagItemKind {
  PLPGSQL_GETDIAG_ROW_COUNT = 0,
  PLPGSQL_GETDIAG_CONTEXT = 1,
  PLPGSQL_GETDIAG_ERROR_CONTEXT = 2,
  PLPGSQL_GETDIAG_ERROR_DETAIL = 3,
  PLPGSQL_GETDIAG_ERROR_HINT = 4,
  PLPGSQL_GETDIAG_RETURNED_SQLSTATE = 5,
  PLPGSQL_GETDIAG_COLUMN_NAME = 6,
  PLPGSQL_GETDIAG_CONSTRAINT_NAME = 7,
  PLPGSQL_GETDIAG_DATATYPE_NAME = 8,
  PLPGSQL_GETDIAG_MESSAGE_TEXT = 9,
  PLPGSQL_GETDIAG_TABLE_NAME = 10,
  PLPGSQL_GETDIAG_SCHEMA_NAME = 11,
}

// Raise option types
export enum RaiseOptionType {
  PLPGSQL_RAISEOPTION_ERRCODE = 0,
  PLPGSQL_RAISEOPTION_MESSAGE = 1,
  PLPGSQL_RAISEOPTION_DETAIL = 2,
  PLPGSQL_RAISEOPTION_HINT = 3,
  PLPGSQL_RAISEOPTION_COLUMN = 4,
  PLPGSQL_RAISEOPTION_CONSTRAINT = 5,
  PLPGSQL_RAISEOPTION_DATATYPE = 6,
  PLPGSQL_RAISEOPTION_TABLE = 7,
  PLPGSQL_RAISEOPTION_SCHEMA = 8,
}
