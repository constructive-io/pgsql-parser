/**
 * Enhanced deparse that re-injects body comments into PL/pgSQL function
 * bodies after the standard plpgsql-deparser has produced its output.
 *
 * Also handles outer SQL comments/whitespace via pgsql-parse's deparser.
 *
 * This module does NOT modify plpgsql-deparser or pgsql-deparser.
 */

import {
  parsePlPgSQLSync,
  parseSync as parseSqlSync,
} from '@libpg-query/parser';
import type { ParseResult } from '@libpg-query/parser';
import {
  deparseEnhanced,
  isRawComment,
  isRawWhitespace,
  isRawStmt,
  type EnhancedParseResult,
} from 'pgsql-parse';
import { Deparser } from 'pgsql-deparser';
import {
  hydratePlpgsqlAst,
  dehydratePlpgsqlAst,
  deparseFunctionSync,
  type PLpgSQLParseResult,
} from 'plpgsql-deparser';
import { getReturnInfoFromParsedFunction } from './return-info';
import { scanBodyComments, groupCommentsByAnchor } from './body-scanner';
import type { PlpgsqlParseResult, FunctionComments, BodyComment } from './types';

export interface DeparseOptions {
  pretty?: boolean;
  newline?: string;
}

/**
 * Deparse a PlpgsqlParseResult back to SQL, preserving both outer
 * comments/whitespace AND comments inside PL/pgSQL function bodies.
 */
export function deparseSync(result: PlpgsqlParseResult, options: DeparseOptions = {}): string {
  const { pretty = true, newline = '\n' } = options;
  const enhanced = result.enhanced;
  const functionMap = new Map<number, FunctionComments>();
  for (const fn of result.functions) {
    functionMap.set(fn.stmtIndex, fn);
  }

  const lines: string[] = [];

  for (let i = 0; i < enhanced.stmts.length; i++) {
    const entry = enhanced.stmts[i];

    if (isRawComment(entry)) {
      const commentText = `--${entry.RawComment.text}`;
      if (entry.RawComment.trailing && lines.length > 0) {
        lines[lines.length - 1] += ' ' + commentText;
      } else {
        lines.push(commentText);
      }
    } else if (isRawWhitespace(entry)) {
      for (let b = 0; b < entry.RawWhitespace.lines; b++) {
        lines.push('');
      }
    } else if (isRawStmt(entry)) {
      const fnComments = functionMap.get(i);
      if (fnComments) {
        // This is a PL/pgSQL function — deparse with body comments
        const sql = deparseWithBodyComments(entry, fnComments, pretty);
        if (sql) lines.push(sql);
      } else {
        // Standard SQL statement
        const sql = Deparser.deparse({ version: 0, stmts: [entry] }, { pretty });
        if (sql) lines.push(sql);
      }
    }
  }

  return lines.join(newline);
}

/**
 * Async version of deparseSync.
 */
export async function deparse(result: PlpgsqlParseResult, options: DeparseOptions = {}): Promise<string> {
  return deparseSync(result, options);
}

/**
 * Deparse a single PL/pgSQL CREATE FUNCTION statement, re-injecting
 * body comments into the deparsed function body.
 */
function deparseWithBodyComments(
  rawStmt: any,
  fnComments: FunctionComments,
  pretty: boolean
): string | null {
  const stmt = rawStmt?.stmt;
  if (!stmt) return null;

  const createFunctionStmt = stmt.CreateFunctionStmt;
  if (!createFunctionStmt) return null;

  // Parse the PL/pgSQL body to get the AST
  // We need the full CREATE FUNCTION SQL for parsePlPgSQL, but we
  // only have the AST node. So we first deparse without comments
  // to get valid SQL, then parse the PL/pgSQL body.
  try {
    // First, get a clean deparse of the statement to extract the body
    const cleanSql = Deparser.deparse({ version: 0, stmts: [rawStmt] }, { pretty });
    if (!cleanSql) return null;

    // Parse PL/pgSQL from the clean SQL
    const plpgsqlRaw = parsePlPgSQLSync(cleanSql) as unknown as PLpgSQLParseResult;
    const { ast: hydrated } = hydratePlpgsqlAst(plpgsqlRaw);
    const dehydrated = dehydratePlpgsqlAst(hydrated);

    const plpgsqlFunc = dehydrated.plpgsql_funcs?.[0]?.PLpgSQL_function;
    if (!plpgsqlFunc) return cleanSql;

    // Get return info for correct RETURN statement handling
    const returnInfo = getReturnInfoForStmt(createFunctionStmt);

    // Deparse the PL/pgSQL body
    const deparsedBody = deparseFunctionSync(plpgsqlFunc, undefined, returnInfo);

    // Re-inject comments into the deparsed body
    const enhancedBody = reinjectBodyComments(
      fnComments.originalBody,
      deparsedBody,
      fnComments.comments,
      plpgsqlRaw
    );

    // Stitch the enhanced body back into the AST
    stitchBodyIntoAst(createFunctionStmt, enhancedBody);

    // Deparse the full statement with the enhanced body
    const result = Deparser.deparse({ version: 0, stmts: [rawStmt] }, { pretty });
    return result || null;
  } catch {
    // If anything fails, fall back to standard deparse
    return Deparser.deparse({ version: 0, stmts: [rawStmt] }, { pretty }) || null;
  }
}

/**
 * Re-inject comments into a deparsed PL/pgSQL function body.
 *
 * Strategy:
 * 1. Collect statement linenos from the PL/pgSQL AST (DFS order)
 * 2. Associate each comment with the next statement by lineno
 * 3. Walk the deparsed output line-by-line, tracking statement indices
 * 4. Insert comments before their associated statement's output
 *
 * Uses sequential keyword matching: the deparser emits statements in
 * the same order as the AST's body arrays, so we match them in order.
 */
function reinjectBodyComments(
  originalBody: string,
  deparsedBody: string,
  comments: BodyComment[],
  plpgsqlAst: PLpgSQLParseResult
): string {
  if (comments.length === 0) return deparsedBody;

  // 1. Collect statement linenos from the AST
  const stmtLinenos = collectStmtLinenos(plpgsqlAst);

  // 2. Group comments by anchor statement
  const groups = groupCommentsByAnchor(comments, stmtLinenos);
  if (groups.length === 0) return deparsedBody;

  // 3. Build a map of anchorLineno → comment texts
  const commentsByAnchor = new Map<number, string[]>();
  const trailingComments: string[] = [];
  for (const group of groups) {
    if (group.anchorLineno !== null) {
      const existing = commentsByAnchor.get(group.anchorLineno) ?? [];
      existing.push(...group.comments);
      commentsByAnchor.set(group.anchorLineno, existing);
    } else {
      trailingComments.push(...group.comments);
    }
  }

  // 4. Walk the deparsed body and insert comments at statement boundaries
  const depLines = deparsedBody.split('\n');
  const result: string[] = [];

  // Build an ordered list of (lineno, keyword) for matching
  const stmtKeywords = buildStmtKeywords(plpgsqlAst);
  let stmtKeyIdx = 0;
  const usedAnchors = new Set<number>();

  for (const line of depLines) {
    const trimmed = line.trim().toUpperCase();

    // Try to match this line to the next expected statement
    if (stmtKeyIdx < stmtKeywords.length) {
      const { lineno, keywords } = stmtKeywords[stmtKeyIdx];

      if (lineMatchesKeywords(trimmed, keywords)) {
        // Insert comments anchored to this statement
        if (commentsByAnchor.has(lineno) && !usedAnchors.has(lineno)) {
          const indent = line.match(/^\s*/)?.[0] ?? '';
          for (const commentText of commentsByAnchor.get(lineno)!) {
            result.push(indent + commentText);
          }
          usedAnchors.add(lineno);
        }
        stmtKeyIdx++;
      }
    }

    result.push(line);
  }

  // Append any trailing comments before the final END
  if (trailingComments.length > 0) {
    // Find the last END line and insert before it
    const lastEndIdx = findLastEndLine(result);
    if (lastEndIdx >= 0) {
      const indent = result[lastEndIdx].match(/^\s*/)?.[0] ?? '  ';
      const commentLines = trailingComments.map(c => indent + c);
      result.splice(lastEndIdx, 0, ...commentLines);
    } else {
      for (const c of trailingComments) {
        result.push('  ' + c);
      }
    }
  }

  return result.join('\n');
}

/**
 * Collect all statement linenos from a PL/pgSQL parse result in DFS body order.
 */
function collectStmtLinenos(ast: PLpgSQLParseResult): number[] {
  const linenos: number[] = [];
  if (!ast.plpgsql_funcs) return linenos;

  for (const funcNode of ast.plpgsql_funcs) {
    if ('PLpgSQL_function' in funcNode) {
      const func = funcNode.PLpgSQL_function;
      if (func.action) {
        collectStmtLinenosFromNode(func.action, linenos);
      }
    }
  }

  return linenos.sort((a, b) => a - b);
}

/**
 * Recursively collect linenos from PL/pgSQL statement nodes.
 */
function collectStmtLinenosFromNode(stmtNode: any, linenos: number[]): void {
  const [kind, data] = Object.entries(stmtNode)[0] as [string, any];

  if (data?.lineno !== undefined) {
    linenos.push(data.lineno);
  }

  // Recurse into body arrays
  const bodyKeys = ['body', 'then_body', 'else_body', 'else_stmts', 'action'];
  for (const key of bodyKeys) {
    const arr = data?.[key];
    if (Array.isArray(arr)) {
      for (const child of arr) {
        collectStmtLinenosFromNode(child, linenos);
      }
    }
  }

  // Recurse into elsif_list
  if (data?.elsif_list) {
    for (const elsif of data.elsif_list) {
      const elsifData = (elsif as any)?.PLpgSQL_if_elsif;
      if (elsifData?.stmts) {
        for (const child of elsifData.stmts) {
          collectStmtLinenosFromNode(child, linenos);
        }
      }
    }
  }

  // Recurse into case_when_list
  if (data?.case_when_list) {
    for (const when of data.case_when_list) {
      const whenData = (when as any)?.PLpgSQL_case_when;
      if (whenData?.stmts) {
        for (const child of whenData.stmts) {
          collectStmtLinenosFromNode(child, linenos);
        }
      }
    }
  }

  // Recurse into exception handlers
  const excList = data?.exceptions?.exc_list ??
    (data?.exceptions as any)?.PLpgSQL_exception_block?.exc_list;
  if (excList) {
    for (const exc of excList) {
      const excData = (exc as any)?.PLpgSQL_exception;
      if (excData?.action) {
        for (const child of excData.action) {
          collectStmtLinenosFromNode(child, linenos);
        }
      }
    }
  }
}

interface StmtKeyword {
  lineno: number;
  keywords: string[];
}

/**
 * Build an ordered list of (lineno, keywords) for matching deparsed output.
 * Keywords are the first tokens expected for each statement type.
 */
function buildStmtKeywords(ast: PLpgSQLParseResult): StmtKeyword[] {
  const result: StmtKeyword[] = [];
  if (!ast.plpgsql_funcs) return result;

  for (const funcNode of ast.plpgsql_funcs) {
    if ('PLpgSQL_function' in funcNode) {
      const func = funcNode.PLpgSQL_function;
      if (func.action) {
        collectStmtKeywordsFromBlock(func.action, result);
      }
    }
  }

  // Sort by lineno to match comment association order
  result.sort((a, b) => a.lineno - b.lineno);
  return result;
}

/**
 * Recursively collect statement keywords from a block's body.
 * Only collects from direct body statements, not nested blocks' bodies
 * (those are handled when their enclosing block keyword is matched).
 */
function collectStmtKeywordsFromBlock(blockNode: any, result: StmtKeyword[]): void {
  const block = blockNode?.PLpgSQL_stmt_block;
  if (!block?.body) return;

  for (const stmt of block.body) {
    const [kind, data] = Object.entries(stmt)[0] as [string, any];
    if (data?.lineno === undefined) continue;

    const keywords = getKeywordsForStmtKind(kind, data);
    result.push({ lineno: data.lineno, keywords });

    // Recurse into nested structures to collect their direct children
    if (kind === 'PLpgSQL_stmt_block') {
      collectStmtKeywordsFromBlock(stmt, result);
    } else if (kind === 'PLpgSQL_stmt_if') {
      collectStmtKeywordsFromIf(data, result);
    } else if (kind === 'PLpgSQL_stmt_case') {
      collectStmtKeywordsFromCase(data, result);
    } else if (kind === 'PLpgSQL_stmt_loop' || kind === 'PLpgSQL_stmt_while' ||
               kind === 'PLpgSQL_stmt_fori' || kind === 'PLpgSQL_stmt_fors' ||
               kind === 'PLpgSQL_stmt_forc' || kind === 'PLpgSQL_stmt_foreach_a' ||
               kind === 'PLpgSQL_stmt_dynfors') {
      if (data.body) {
        for (const child of data.body) {
          const [childKind, childData] = Object.entries(child)[0] as [string, any];
          if (childData?.lineno !== undefined) {
            result.push({ lineno: childData.lineno, keywords: getKeywordsForStmtKind(childKind, childData) });
          }
          if (childKind === 'PLpgSQL_stmt_block') {
            collectStmtKeywordsFromBlock(child, result);
          }
        }
      }
    }

    // Recurse into exception handlers
    if (kind === 'PLpgSQL_stmt_block') {
      const excList = data?.exceptions?.exc_list ??
        (data?.exceptions as any)?.PLpgSQL_exception_block?.exc_list;
      if (excList) {
        for (const exc of excList) {
          const excData = (exc as any)?.PLpgSQL_exception;
          if (excData?.action) {
            for (const child of excData.action) {
              const [childKind, childData] = Object.entries(child)[0] as [string, any];
              if (childData?.lineno !== undefined) {
                result.push({ lineno: childData.lineno, keywords: getKeywordsForStmtKind(childKind, childData) });
              }
            }
          }
        }
      }
    }
  }
}

function collectStmtKeywordsFromIf(ifData: any, result: StmtKeyword[]): void {
  // then_body
  if (ifData.then_body) {
    for (const child of ifData.then_body) {
      const [kind, data] = Object.entries(child)[0] as [string, any];
      if (data?.lineno !== undefined) {
        result.push({ lineno: data.lineno, keywords: getKeywordsForStmtKind(kind, data) });
      }
      if (kind === 'PLpgSQL_stmt_block') {
        collectStmtKeywordsFromBlock(child, result);
      }
    }
  }
  // elsif_list
  if (ifData.elsif_list) {
    for (const elsif of ifData.elsif_list) {
      const elsifData = (elsif as any)?.PLpgSQL_if_elsif;
      if (elsifData?.stmts) {
        for (const child of elsifData.stmts) {
          const [kind, data] = Object.entries(child)[0] as [string, any];
          if (data?.lineno !== undefined) {
            result.push({ lineno: data.lineno, keywords: getKeywordsForStmtKind(kind, data) });
          }
          if (kind === 'PLpgSQL_stmt_block') {
            collectStmtKeywordsFromBlock(child, result);
          }
        }
      }
    }
  }
  // else_body
  if (ifData.else_body) {
    for (const child of ifData.else_body) {
      const [kind, data] = Object.entries(child)[0] as [string, any];
      if (data?.lineno !== undefined) {
        result.push({ lineno: data.lineno, keywords: getKeywordsForStmtKind(kind, data) });
      }
      if (kind === 'PLpgSQL_stmt_block') {
        collectStmtKeywordsFromBlock(child, result);
      }
    }
  }
}

function collectStmtKeywordsFromCase(caseData: any, result: StmtKeyword[]): void {
  if (caseData.case_when_list) {
    for (const when of caseData.case_when_list) {
      const whenData = (when as any)?.PLpgSQL_case_when;
      if (whenData?.stmts) {
        for (const child of whenData.stmts) {
          const [kind, data] = Object.entries(child)[0] as [string, any];
          if (data?.lineno !== undefined) {
            result.push({ lineno: data.lineno, keywords: getKeywordsForStmtKind(kind, data) });
          }
          if (kind === 'PLpgSQL_stmt_block') {
            collectStmtKeywordsFromBlock(child, result);
          }
        }
      }
    }
  }
  if (caseData.have_else && caseData.else_stmts) {
    for (const child of caseData.else_stmts) {
      const [kind, data] = Object.entries(child)[0] as [string, any];
      if (data?.lineno !== undefined) {
        result.push({ lineno: data.lineno, keywords: getKeywordsForStmtKind(kind, data) });
      }
      if (kind === 'PLpgSQL_stmt_block') {
        collectStmtKeywordsFromBlock(child, result);
      }
    }
  }
}

/**
 * Map PL/pgSQL statement kind to the keywords that would start
 * its deparsed output line (uppercase).
 */
function getKeywordsForStmtKind(kind: string, data: any): string[] {
  const map: Record<string, string[]> = {
    PLpgSQL_stmt_block: ['BEGIN', '<<'],
    PLpgSQL_stmt_assign: [], // starts with variable name — handled separately
    PLpgSQL_stmt_if: ['IF'],
    PLpgSQL_stmt_case: ['CASE'],
    PLpgSQL_stmt_loop: ['LOOP'],
    PLpgSQL_stmt_while: ['WHILE'],
    PLpgSQL_stmt_fori: ['FOR'],
    PLpgSQL_stmt_fors: ['FOR'],
    PLpgSQL_stmt_forc: ['FOR'],
    PLpgSQL_stmt_foreach_a: ['FOREACH'],
    PLpgSQL_stmt_exit: ['EXIT', 'CONTINUE'],
    PLpgSQL_stmt_return: ['RETURN'],
    PLpgSQL_stmt_return_next: ['RETURN'],
    PLpgSQL_stmt_return_query: ['RETURN'],
    PLpgSQL_stmt_raise: ['RAISE'],
    PLpgSQL_stmt_assert: ['ASSERT'],
    PLpgSQL_stmt_execsql: [], // SQL statement — handled separately
    PLpgSQL_stmt_dynexecute: ['EXECUTE'],
    PLpgSQL_stmt_dynfors: ['FOR'],
    PLpgSQL_stmt_getdiag: ['GET'],
    PLpgSQL_stmt_open: ['OPEN'],
    PLpgSQL_stmt_fetch: ['FETCH'],
    PLpgSQL_stmt_close: ['CLOSE'],
    PLpgSQL_stmt_perform: ['PERFORM'],
    PLpgSQL_stmt_call: ['CALL'],
    PLpgSQL_stmt_commit: ['COMMIT'],
    PLpgSQL_stmt_rollback: ['ROLLBACK'],
    PLpgSQL_stmt_set: ['SET'],
  };

  const keywords = map[kind];
  if (keywords && keywords.length > 0) return keywords;

  // For assignment and execsql, try to extract the first word from the expr
  if (kind === 'PLpgSQL_stmt_assign') {
    // Assignment: extract from the expression query string
    const query = data?.expr?.PLpgSQL_expr?.query;
    if (query) {
      const firstWord = query.trim().split(/[\s:=]+/)[0].toUpperCase();
      if (firstWord) return [firstWord];
    }
  }

  if (kind === 'PLpgSQL_stmt_execsql') {
    // execsql: the first word of the SQL query
    const query = data?.sqlstmt?.PLpgSQL_expr?.query;
    if (query) {
      const firstWord = query.trim().split(/\s+/)[0].toUpperCase();
      if (firstWord) return [firstWord];
    }
  }

  return [];
}

/**
 * Check if a deparsed line starts with any of the given keywords.
 */
function lineMatchesKeywords(trimmedUpperLine: string, keywords: string[]): boolean {
  if (keywords.length === 0) {
    // No keywords to match — match any non-structural line
    // (not BEGIN, END, DECLARE, EXCEPTION, WHEN, ELSE, ELSIF)
    const structural = ['BEGIN', 'END', 'DECLARE', 'EXCEPTION', 'WHEN', 'ELSE', 'ELSIF', 'END IF', 'END LOOP', 'END CASE'];
    return !structural.some(s => trimmedUpperLine.startsWith(s)) && trimmedUpperLine.length > 0;
  }

  for (const kw of keywords) {
    if (trimmedUpperLine.startsWith(kw)) {
      // Make sure it's a word boundary (followed by space, semicolon, or end)
      const nextChar = trimmedUpperLine[kw.length];
      if (nextChar === undefined || nextChar === ' ' || nextChar === ';' || nextChar === '\t' || nextChar === '>' || nextChar === '\n') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Find the index of the last END line in the result array.
 */
function findLastEndLine(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().toUpperCase().startsWith('END')) {
      return i;
    }
  }
  return -1;
}

/**
 * Replace the function body in a CREATE FUNCTION AST node.
 */
function stitchBodyIntoAst(createFunctionStmt: any, newBody: string): void {
  if (!createFunctionStmt?.options) return;

  for (const opt of createFunctionStmt.options) {
    if (opt?.DefElem?.defname === 'as') {
      const arg = opt.DefElem.arg;
      if (arg?.List?.items?.[0]?.String) {
        arg.List.items[0].String.sval = newBody;
        return;
      }
      if (arg?.String) {
        arg.String.sval = newBody;
        return;
      }
    }
  }
}

/**
 * Extract return info from a CREATE FUNCTION statement for correct
 * RETURN statement handling in the PL/pgSQL deparser.
 */
function getReturnInfoForStmt(createFunctionStmt: any): any {
  // Check for RETURNS TABLE / SETOF
  const returnType = createFunctionStmt?.returnType;
  if (returnType) {
    // SETOF
    if (returnType.TypeName?.setof) {
      return { kind: 'setof' };
    }
    // RETURNS TABLE
    if (returnType.TypeName?.names) {
      const names = returnType.TypeName.names;
      for (const n of names) {
        if (n?.String?.sval === 'record') {
          return { kind: 'setof' };
        }
      }
    }
  }

  // Check for OUT parameters
  const params = createFunctionStmt?.parameters;
  if (params) {
    for (const p of params) {
      const fp = p?.FunctionParameter;
      if (fp?.mode === 'FUNC_PARAM_OUT' || fp?.mode === 'FUNC_PARAM_INOUT' || fp?.mode === 'FUNC_PARAM_TABLE') {
        return { kind: 'out_params' };
      }
    }
  }

  // Check for RETURNS void
  if (returnType?.TypeName?.names) {
    const names = returnType.TypeName.names;
    for (const n of names) {
      if (n?.String?.sval === 'void') {
        return { kind: 'void' };
      }
    }
  }

  // Check for RETURNS trigger
  if (returnType?.TypeName?.names) {
    const names = returnType.TypeName.names;
    for (const n of names) {
      if (n?.String?.sval === 'trigger') {
        return { kind: 'trigger' };
      }
    }
  }

  return { kind: 'scalar' };
}
