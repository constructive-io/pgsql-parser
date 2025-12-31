import { ParseResult, Node } from '@pgsql/types';

export enum ParseMode {
  RAW_PARSE_DEFAULT = 0,
  RAW_PARSE_TYPE_NAME = 1,
  RAW_PARSE_PLPGSQL_EXPR = 2,
  RAW_PARSE_PLPGSQL_ASSIGN1 = 3,
  RAW_PARSE_PLPGSQL_ASSIGN2 = 4,
  RAW_PARSE_PLPGSQL_ASSIGN3 = 5,
}

export interface HydratedExprRaw {
  kind: 'raw';
  original: string;
  parseMode: number;
  error?: string;
}

export interface HydratedExprSqlStmt {
  kind: 'sql-stmt';
  original: string;
  parseMode: number;
  parseResult: ParseResult;
}

export interface HydratedExprSqlExpr {
  kind: 'sql-expr';
  original: string;
  parseMode: number;
  expr: Node;
}

export interface HydratedExprAssign {
  kind: 'assign';
  original: string;
  parseMode: number;
  target: string;
  targetExpr?: Node;
  value: string;
  valueExpr?: Node;
  error?: string;
}

export type HydratedExprQuery =
  | HydratedExprRaw
  | HydratedExprSqlStmt
  | HydratedExprSqlExpr
  | HydratedExprAssign;

export interface HydratedPLpgSQL_expr {
  query: HydratedExprQuery;
}

export interface HydrationOptions {
  parseExpressions?: boolean;
  parseAssignments?: boolean;
  continueOnError?: boolean;
}

export interface HydrationResult<T> {
  ast: T;
  errors: HydrationError[];
  stats: HydrationStats;
}

export interface HydrationError {
  path: string;
  original: string;
  parseMode: number;
  error: string;
}

export interface HydrationStats {
  totalExpressions: number;
  parsedExpressions: number;
  failedExpressions: number;
  assignmentExpressions: number;
  sqlExpressions: number;
  rawExpressions: number;
}
