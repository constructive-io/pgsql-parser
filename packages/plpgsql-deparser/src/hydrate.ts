import { parseSync, scanSync } from '@libpg-query/parser';
import { ParseResult, Node } from '@pgsql/types';
import { Deparser, DeparserOptions } from 'pgsql-deparser';
import {
  HydratedExprQuery,
  HydratedExprRaw,
  HydratedExprSqlExpr,
  HydratedExprSqlStmt,
  HydratedExprAssign,
  HydratedTypeName,
  HydrationOptions,
  HydrationResult,
  HydrationError,
  HydrationStats,
  ParseMode,
} from './hydrate-types';
import { PLpgSQLParseResult } from './types';

/**
 * Options for dehydrating (converting back to strings) a hydrated PL/pgSQL AST
 */
export interface DehydrationOptions {
  /**
   * Options to pass to the SQL deparser when deparsing sql-stmt expressions.
   * This allows callers to control formatting (pretty printing, etc.) of
   * embedded SQL statements inside PL/pgSQL function bodies.
   */
  sqlDeparseOptions?: DeparserOptions;
}

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
    typeNameExpressions: 0,
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

  // Handle PLpgSQL_type nodes (variable type declarations)
  // Parse the typname string into a TypeName AST node
  if ('PLpgSQL_type' in node) {
    const plType = node.PLpgSQL_type;
    if (plType.typname && typeof plType.typname === 'string') {
      const hydratedTypename = hydrateTypeName(
        plType.typname,
        `${path}.PLpgSQL_type.typname`,
        errors,
        stats
      );

      return {
        PLpgSQL_type: {
          ...plType,
          typname: hydratedTypename,
        },
      };
    }
  }

  const result: any = {};
  for (const [key, value] of Object.entries(node)) {
    result[key] = hydrateNode(value, `${path}.${key}`, options, errors, stats);
  }
  return result;
}

/**
 * Extract the TypeName node from a parsed cast expression.
 * Given a parse result from "SELECT NULL::typename", extracts the TypeName node.
 */
function extractTypeNameFromCast(result: ParseResult): Node | undefined {
  const stmt = result.stmts?.[0]?.stmt as any;
  if (stmt?.SelectStmt?.targetList?.[0]?.ResTarget?.val?.TypeCast?.typeName) {
    return stmt.SelectStmt.targetList[0].ResTarget.val.TypeCast.typeName;
  }
  return undefined;
}

/**
 * Hydrate a PLpgSQL_type typname string into a HydratedTypeName.
 * 
 * Parses the typname string (e.g., "schema.typename") into a TypeName AST node
 * by wrapping it in a cast expression: SELECT NULL::typename
 * 
 * Handles special suffixes like %rowtype and %type by stripping them before
 * parsing and preserving them in the result.
 */
function hydrateTypeName(
  typname: string,
  path: string,
  errors: HydrationError[],
  stats: HydrationStats
): HydratedTypeName | string {
  // Handle %rowtype and %type suffixes - these can't be parsed as SQL types
  let suffix: string | undefined;
  let baseTypname = typname;
  
  const suffixMatch = typname.match(/(%rowtype|%type)$/i);
  if (suffixMatch) {
    suffix = suffixMatch[1];
    baseTypname = typname.substring(0, typname.length - suffix.length);
  }
  
  // Check if this is a schema-qualified type (contains a dot)
  // We need to be careful with quoted identifiers - "schema".type or schema."type"
  // A simple heuristic: if there's a dot not inside quotes, it's schema-qualified
  const hasSchemaQualification = /^[^"]*\.|"[^"]*"\./i.test(baseTypname);
  
  // Skip hydration for simple built-in types without schema qualification
  // These don't benefit from AST transformation
  if (!hasSchemaQualification) {
    return typname;
  }
  
  // Remove pg_catalog prefix for built-in types (but only if no suffix)
  let parseTypname = baseTypname;
  if (!suffix) {
    parseTypname = parseTypname.replace(/^pg_catalog\./, '');
  }
  
  try {
    // Parse the type name by wrapping it in a cast expression
    // Keep quotes intact for proper parsing of special identifiers
    const sql = `SELECT NULL::${parseTypname}`;
    const parseResult = parseSync(sql);
    const typeNameNode = extractTypeNameFromCast(parseResult);
    
    if (typeNameNode) {
      stats.typeNameExpressions++;
      return {
        kind: 'type-name',
        original: typname,
        typeNameNode,
        suffix,
      };
    }
    
    // If we couldn't extract the TypeName, throw to trigger error handling
    throw new Error('Could not extract TypeName from cast expression');
  } catch (err) {
    // If parsing fails, record the error and throw
    const error: HydrationError = {
      path,
      original: typname,
      parseMode: ParseMode.RAW_PARSE_TYPE_NAME,
      error: err instanceof Error ? err.message : String(err),
    };
    errors.push(error);
    throw new Error(`Failed to hydrate PLpgSQL_type typname "${typname}": ${error.error}`);
  }
}

function hydrateExpression(
  query: string | HydratedExprQuery,
  parseMode: number,
  path: string,
  options: HydrationOptions,
  errors: HydrationError[],
  stats: HydrationStats
): HydratedExprQuery {
  // If query is already hydrated (from a previous hydration call), return it unchanged
  if (isHydratedExpr(query)) {
    return query;
  }
  
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
    let assignTokenText = '';
    let parenDepth = 0;
    let bracketDepth = 0;

    for (let i = 0; i < tokens.tokens.length; i++) {
      const token = tokens.tokens[i];

      if (token.text === '(') parenDepth++;
      else if (token.text === ')') parenDepth--;
      else if (token.text === '[') bracketDepth++;
      else if (token.text === ']') bracketDepth--;

      // Check for := first (preferred PL/pgSQL assignment operator)
      if (token.text === ':=' && parenDepth === 0 && bracketDepth === 0) {
        assignIndex = i;
        assignTokenText = ':=';
        break;
      }
      
      // Also check for = (valid PL/pgSQL assignment operator)
      // But avoid => (named parameter syntax) by checking the previous token
      if (token.text === '=' && parenDepth === 0 && bracketDepth === 0) {
        // Make sure this isn't part of => (named parameter)
        // or comparison operators like >=, <=, <>, !=
        const prevToken = i > 0 ? tokens.tokens[i - 1] : null;
        const prevText = prevToken?.text || '';
        
        // Skip if previous token suggests this is not an assignment
        if (prevText === '>' || prevText === '<' || prevText === '!' || prevText === ':') {
          continue;
        }
        
        // This looks like an assignment with =
        assignIndex = i;
        assignTokenText = '=';
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
    // Fallback: try to find := first, then =
    const colonIndex = query.indexOf(':=');
    if (colonIndex !== -1) {
      const target = query.substring(0, colonIndex).trim();
      const value = query.substring(colonIndex + 2).trim();
      return { target, value };
    }
    
    // Try to find = (but be careful about >=, <=, <>, !=, =>)
    // Find the first = that's not part of a comparison operator
    for (let i = 0; i < query.length; i++) {
      if (query[i] === '=') {
        const prev = i > 0 ? query[i - 1] : '';
        const next = i < query.length - 1 ? query[i + 1] : '';
        
        // Skip comparison operators
        if (prev === '>' || prev === '<' || prev === '!' || prev === ':' || next === '>') {
          continue;
        }
        
        const target = query.substring(0, i).trim();
        const value = query.substring(i + 1).trim();
        return { target, value };
      }
    }
    
    return null;
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

/**
 * Check if a typname value is a hydrated type name object.
 */
export function isHydratedTypeName(typname: any): typname is HydratedTypeName {
  return Boolean(
    typname &&
    typeof typname === 'object' &&
    'kind' in typname &&
    typname.kind === 'type-name'
  );
}

export function getOriginalQuery(query: string | HydratedExprQuery): string {
  if (typeof query === 'string') {
    return query;
  }
  return query.original;
}

export function dehydratePlpgsqlAst<T>(ast: T, options?: DehydrationOptions): T {
  return dehydrateNode(ast, options) as T;
}

function dehydrateNode(node: any, options?: DehydrationOptions): any {
  if (node === null || node === undefined) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(item => dehydrateNode(item, options));
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
      dehydratedQuery = dehydrateQuery(query, options?.sqlDeparseOptions);
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

  // Handle PLpgSQL_type nodes with hydrated typname
  if ('PLpgSQL_type' in node) {
    const plType = node.PLpgSQL_type;
    const typname = plType.typname;
    
    let dehydratedTypname: string;
    if (typeof typname === 'string') {
      dehydratedTypname = typname;
    } else if (isHydratedTypeName(typname)) {
      dehydratedTypname = dehydrateTypeName(typname, options?.sqlDeparseOptions);
    } else {
      dehydratedTypname = String(typname);
    }

    return {
      PLpgSQL_type: {
        ...plType,
        typname: dehydratedTypname,
      },
    };
  }

  const result: any = {};
  for (const [key, value] of Object.entries(node)) {
    result[key] = dehydrateNode(value, options);
  }
  return result;
}

/**
 * Deparse a single expression AST node by wrapping it in a SELECT statement,
 * deparsing, and stripping the SELECT prefix.
 */
function deparseExprNode(expr: Node, sqlDeparseOptions?: DeparserOptions): string | null {
  try {
    // Wrap the expression in a minimal SELECT statement
    const wrappedStmt = {
      SelectStmt: {
        targetList: [
          {
            ResTarget: {
              val: expr
            }
          }
        ]
      }
    };
    const deparsed = Deparser.deparse(wrappedStmt, sqlDeparseOptions);
    // Strip the "SELECT " prefix (case-insensitive, handles whitespace/newlines)
    const stripped = deparsed.replace(/^SELECT\s+/i, '').replace(/;?\s*$/, '');
    return stripped;
  } catch {
    return null;
  }
}

/**
 * Deparse a TypeName AST node back to a string.
 * Wraps the TypeName in a cast expression, deparses, and extracts the type name.
 */
function deparseTypeNameNode(typeNameNode: Node, sqlDeparseOptions?: DeparserOptions): string | null {
  try {
    // Wrap the TypeName in a cast expression: SELECT NULL::typename
    // We use 'as any' because the Node type is a union type and we know
    // this is specifically a TypeName node from extractTypeNameFromCast
    const wrappedStmt = {
      SelectStmt: {
        targetList: [
          {
            ResTarget: {
              val: {
                TypeCast: {
                  arg: { A_Const: { isnull: true } },
                  typeName: typeNameNode as any
                }
              }
            }
          }
        ]
      }
    } as any;
    const deparsed = Deparser.deparse(wrappedStmt, sqlDeparseOptions);
    // Extract the type name from "SELECT NULL::typename"
    const match = deparsed.match(/SELECT\s+NULL::(.+)/i);
    if (match) {
      return match[1].trim().replace(/;$/, '');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Dehydrate a HydratedTypeName back to a string.
 * Deparses the TypeName AST node and appends any suffix (%rowtype, %type).
 */
function dehydrateTypeName(typname: HydratedTypeName, sqlDeparseOptions?: DeparserOptions): string {
  const deparsed = deparseTypeNameNode(typname.typeNameNode, sqlDeparseOptions);
  if (deparsed !== null) {
    return deparsed + (typname.suffix || '');
  }
  // Fall back to original if deparse fails
  return typname.original;
}

/**
 * Normalize whitespace for comparison purposes.
 * This helps detect if a string field was modified vs just having different formatting.
 */
function normalizeForComparison(str: string): string {
  return str.replace(/\s+/g, ' ').trim().toLowerCase();
}

function dehydrateQuery(query: HydratedExprQuery, sqlDeparseOptions?: DeparserOptions): string {
  switch (query.kind) {
    case 'assign': {
      // For assignments, always prefer deparsing the AST nodes if they exist.
      // This enables AST-based transformations (e.g., schema renaming).
      // Fall back to string fields if AST nodes are missing or deparse fails.
      const assignQuery = query as HydratedExprAssign;
      
      let target = assignQuery.target;
      let value = assignQuery.value;
      
      // For target: prefer deparsed AST if available
      if (assignQuery.targetExpr) {
        const deparsedTarget = deparseExprNode(assignQuery.targetExpr, sqlDeparseOptions);
        if (deparsedTarget !== null) {
          target = deparsedTarget;
        }
      }
      
      // For value: prefer deparsed AST if available
      if (assignQuery.valueExpr) {
        const deparsedValue = deparseExprNode(assignQuery.valueExpr, sqlDeparseOptions);
        if (deparsedValue !== null) {
          value = deparsedValue;
        }
      }
      
      return `${target} := ${value}`;
    }
    case 'sql-stmt': {
      // Deparse the modified parseResult back to SQL
      // This enables AST-based transformations (e.g., schema renaming)
      // Pass through sqlDeparseOptions to control formatting (pretty printing, etc.)
      const stmtQuery = query as HydratedExprSqlStmt;
      if (stmtQuery.parseResult?.stmts?.[0]?.stmt) {
        try {
          return Deparser.deparse(stmtQuery.parseResult.stmts[0].stmt, sqlDeparseOptions);
        } catch {
          // Fall back to original if deparse fails
          return query.original;
        }
      }
      return query.original;
    }
    case 'sql-expr': {
      // For sql-expr, always prefer deparsing the AST.
      // This enables AST-based transformations (e.g., schema renaming).
      // Fall back to original only if deparse fails.
      const exprQuery = query as HydratedExprSqlExpr;
      if (exprQuery.expr) {
        const deparsed = deparseExprNode(exprQuery.expr, sqlDeparseOptions);
        if (deparsed !== null) {
          return deparsed;
        }
      }
      // Fall back to original if deparse fails
      return query.original;
    }
    case 'raw':
    default:
      return query.original;
  }
}
