import { parseSync, scanSync } from '@libpg-query/parser';
import { ParseResult, Node } from '@pgsql/types';
import { Deparser } from 'pgsql-deparser';
import {
  HydratedExprQuery,
  HydratedExprRaw,
  HydratedExprSqlExpr,
  HydratedExprSqlStmt,
  HydratedExprAssign,
  HydrationOptions,
  HydrationResult,
  HydrationError,
  HydrationStats,
  ParseMode,
} from './hydrate-types';
import { PLpgSQLParseResult } from './types';

function extractExprFromSelectWrapper(result: ParseResult): Node | undefined {
  const stmt = result.stmts?.[0]?.stmt as any;
  if (stmt?.SelectStmt?.targetList?.[0]?.ResTarget?.val) {
    return stmt.SelectStmt.targetList[0].ResTarget.val;
  }
  return undefined;
}

const DEFAULT_OPTIONS: HydrationOptions = {
  parseExpressions: true,
  parseAssignments: true,
  continueOnError: true,
};

export function hydratePlpgsqlAst(
  ast: PLpgSQLParseResult,
  options: HydrationOptions = {}
): HydrationResult<PLpgSQLParseResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: HydrationError[] = [];
  const stats: HydrationStats = {
    totalExpressions: 0,
    parsedExpressions: 0,
    failedExpressions: 0,
    assignmentExpressions: 0,
    sqlExpressions: 0,
    rawExpressions: 0,
  };

  const hydratedAst = hydrateNode(ast, '', opts, errors, stats);

  return {
    ast: hydratedAst as PLpgSQLParseResult,
    errors,
    stats,
  };
}

function hydrateNode(
  node: any,
  path: string,
  options: HydrationOptions,
  errors: HydrationError[],
  stats: HydrationStats
): any {
  if (node === null || node === undefined) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((item, i) =>
      hydrateNode(item, `${path}[${i}]`, options, errors, stats)
    );
  }

  if (typeof node !== 'object') {
    return node;
  }

  if ('PLpgSQL_expr' in node) {
    const expr = node.PLpgSQL_expr;
    stats.totalExpressions++;

    const hydratedQuery = hydrateExpression(
      expr.query,
      expr.parseMode,
      path,
      options,
      errors,
      stats
    );

    return {
      PLpgSQL_expr: {
        ...expr,
        query: hydratedQuery,
      },
    };
  }

  const result: any = {};
  for (const [key, value] of Object.entries(node)) {
    result[key] = hydrateNode(value, `${path}.${key}`, options, errors, stats);
  }
  return result;
}

function hydrateExpression(
  query: string,
  parseMode: number,
  path: string,
  options: HydrationOptions,
  errors: HydrationError[],
  stats: HydrationStats
): HydratedExprQuery {
  if (parseMode === ParseMode.RAW_PARSE_PLPGSQL_ASSIGN1 ||
      parseMode === ParseMode.RAW_PARSE_PLPGSQL_ASSIGN2 ||
      parseMode === ParseMode.RAW_PARSE_PLPGSQL_ASSIGN3 ||
      parseMode === 3) {
    if (options.parseAssignments) {
      return hydrateAssignment(query, parseMode, path, errors, stats);
    }
  } else if (parseMode === ParseMode.RAW_PARSE_PLPGSQL_EXPR || parseMode === 2) {
    if (options.parseExpressions) {
      return hydrateSqlExpression(query, parseMode, path, errors, stats);
    }
  } else if (parseMode === ParseMode.RAW_PARSE_DEFAULT || parseMode === 0) {
    if (options.parseExpressions) {
      return hydrateSqlStatement(query, parseMode, path, errors, stats);
    }
  }

  stats.rawExpressions++;
  return {
    kind: 'raw',
    original: query,
    parseMode,
  };
}

function hydrateAssignment(
  query: string,
  parseMode: number,
  path: string,
  errors: HydrationError[],
  stats: HydrationStats
): HydratedExprQuery {
  const splitResult = splitAssignment(query);

  if (!splitResult) {
    stats.failedExpressions++;
    const error: HydrationError = {
      path,
      original: query,
      parseMode,
      error: 'Failed to split assignment expression',
    };
    errors.push(error);
    stats.rawExpressions++;
    return {
      kind: 'raw',
      original: query,
      parseMode,
      error: error.error,
    };
  }

  const { target, value } = splitResult;
  let targetExpr: Node | undefined;
  let valueExpr: Node | undefined;
  let parseError: string | undefined;

  try {
    const targetResult = parseSync(`SELECT ${target}`);
    targetExpr = extractExprFromSelectWrapper(targetResult);
  } catch (err) {
    parseError = `Failed to parse target: ${err instanceof Error ? err.message : String(err)}`;
  }

  try {
    const valueResult = parseSync(`SELECT ${value}`);
    valueExpr = extractExprFromSelectWrapper(valueResult);
  } catch (err) {
    const valueError = `Failed to parse value: ${err instanceof Error ? err.message : String(err)}`;
    parseError = parseError ? `${parseError}; ${valueError}` : valueError;
  }

  if (targetExpr || valueExpr) {
    stats.parsedExpressions++;
    stats.assignmentExpressions++;
  } else {
    stats.failedExpressions++;
    if (parseError) {
      errors.push({
        path,
        original: query,
        parseMode,
        error: parseError,
      });
    }
  }

  const result: HydratedExprAssign = {
    kind: 'assign',
    original: query,
    parseMode,
    target,
    value,
  };

  if (targetExpr) result.targetExpr = targetExpr;
  if (valueExpr) result.valueExpr = valueExpr;
  if (parseError) result.error = parseError;

  return result;
}

function hydrateSqlExpression(
  query: string,
  parseMode: number,
  path: string,
  errors: HydrationError[],
  stats: HydrationStats
): HydratedExprQuery {
  try {
    const result = parseSync(`SELECT ${query}`);
    const expr = extractExprFromSelectWrapper(result);

    if (expr) {
      stats.parsedExpressions++;
      stats.sqlExpressions++;
      return {
        kind: 'sql-expr',
        original: query,
        parseMode,
        expr,
      };
    }

    throw new Error('Could not extract expression from SELECT wrapper');
  } catch (err) {
    stats.failedExpressions++;
    const error: HydrationError = {
      path,
      original: query,
      parseMode,
      error: err instanceof Error ? err.message : String(err),
    };
    errors.push(error);
    stats.rawExpressions++;
    return {
      kind: 'raw',
      original: query,
      parseMode,
      error: error.error,
    };
  }
}

function hydrateSqlStatement(
  query: string,
  parseMode: number,
  path: string,
  errors: HydrationError[],
  stats: HydrationStats
): HydratedExprQuery {
  try {
    const result = parseSync(query);

    if (result.stmts && result.stmts.length > 0) {
      stats.parsedExpressions++;
      stats.sqlExpressions++;
      return {
        kind: 'sql-stmt',
        original: query,
        parseMode,
        parseResult: result,
      } as any;
    }

    throw new Error('No statements found in parse result');
  } catch (err) {
    stats.failedExpressions++;
    const error: HydrationError = {
      path,
      original: query,
      parseMode,
      error: err instanceof Error ? err.message : String(err),
    };
    errors.push(error);
    stats.rawExpressions++;
    return {
      kind: 'raw',
      original: query,
      parseMode,
      error: error.error,
    };
  }
}

function splitAssignment(query: string): { target: string; value: string } | null {
  try {
    const tokens = scanSync(query);
    let assignIndex = -1;
    let parenDepth = 0;
    let bracketDepth = 0;

    for (let i = 0; i < tokens.tokens.length; i++) {
      const token = tokens.tokens[i];

      if (token.text === '(') parenDepth++;
      else if (token.text === ')') parenDepth--;
      else if (token.text === '[') bracketDepth++;
      else if (token.text === ']') bracketDepth--;

      if (token.text === ':=' && parenDepth === 0 && bracketDepth === 0) {
        assignIndex = i;
        break;
      }
    }

    if (assignIndex === -1) {
      return null;
    }

    const assignToken = tokens.tokens[assignIndex];
    const target = query.substring(0, assignToken.start).trim();
    const value = query.substring(assignToken.end).trim();

    return { target, value };
  } catch (err) {
    const colonIndex = query.indexOf(':=');
    if (colonIndex === -1) {
      return null;
    }
    const target = query.substring(0, colonIndex).trim();
    const value = query.substring(colonIndex + 2).trim();
    return { target, value };
  }
}

export function isHydratedExpr(query: any): query is HydratedExprQuery {
  return Boolean(
    query &&
    typeof query === 'object' &&
    'kind' in query &&
    ['raw', 'sql-stmt', 'sql-expr', 'assign'].includes(query.kind)
  );
}

export function getOriginalQuery(query: string | HydratedExprQuery): string {
  if (typeof query === 'string') {
    return query;
  }
  return query.original;
}

export function dehydratePlpgsqlAst<T>(ast: T): T {
  return dehydrateNode(ast) as T;
}

function dehydrateNode(node: any): any {
  if (node === null || node === undefined) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(item => dehydrateNode(item));
  }

  if (typeof node !== 'object') {
    return node;
  }

  if ('PLpgSQL_expr' in node) {
    const expr = node.PLpgSQL_expr;
    const query = expr.query;
    
    let dehydratedQuery: string;
    if (typeof query === 'string') {
      dehydratedQuery = query;
    } else if (isHydratedExpr(query)) {
      dehydratedQuery = dehydrateQuery(query);
    } else {
      dehydratedQuery = String(query);
    }

    return {
      PLpgSQL_expr: {
        ...expr,
        query: dehydratedQuery,
      },
    };
  }

  const result: any = {};
  for (const [key, value] of Object.entries(node)) {
    result[key] = dehydrateNode(value);
  }
  return result;
}

function dehydrateQuery(query: HydratedExprQuery): string {
  switch (query.kind) {
    case 'assign': {
      // For assignments, use the target and value strings directly
      // These may have been modified by the caller
      const assignQuery = query as HydratedExprAssign;
      return `${assignQuery.target} := ${assignQuery.value}`;
    }
    case 'sql-stmt': {
      // Deparse the modified parseResult back to SQL
      // This enables AST-based transformations (e.g., schema renaming)
      const stmtQuery = query as HydratedExprSqlStmt;
      if (stmtQuery.parseResult?.stmts?.[0]?.stmt) {
        try {
          return Deparser.deparse(stmtQuery.parseResult.stmts[0].stmt);
        } catch {
          // Fall back to original if deparse fails
          return query.original;
        }
      }
      return query.original;
    }
    case 'sql-expr':
      // For sql-expr, return the original string
      // Callers can modify query.original directly for simple transformations
      // For AST-based transformations, use sql-stmt instead
      return query.original;
    case 'raw':
    default:
      return query.original;
  }
}
