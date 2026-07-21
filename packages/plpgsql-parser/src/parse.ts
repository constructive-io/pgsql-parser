import {
  parseSync as parseSqlSync,
  parsePlPgSQLSync,
  loadModule
} from 'libpg-query';
import type { ParseResult } from 'libpg-query';
import {
  hydratePlpgsqlAst,
  PLpgSQLParseResult
} from 'plpgsql-deparser';
import type {
  ParsedScript,
  ParsedFunction,
  ParsedStatement,
  ParsedItem,
  ParseOptions
} from './types';

export { loadModule };

function getLanguageFromOptions(options: any[]): string | null {
  if (!options) return null;
  for (const opt of options) {
    if (opt?.DefElem?.defname === 'language') {
      const arg = opt.DefElem.arg;
      if (arg?.String?.sval) {
        return arg.String.sval.toLowerCase();
      }
    }
  }
  return null;
}

function getBodyFromOptions(options: any[]): { raw: string; delimiter: string } | null {
  if (!options) return null;
  for (const opt of options) {
    if (opt?.DefElem?.defname === 'as') {
      const arg = opt.DefElem.arg;
      if (arg?.List?.items?.[0]?.String?.sval) {
        return {
          raw: arg.List.items[0].String.sval,
          delimiter: '$$'
        };
      }
      if (arg?.String?.sval) {
        return {
          raw: arg.String.sval,
          delimiter: '$$'
        };
      }
    }
  }
  return null;
}

function isPlpgsqlFunction(stmt: any): boolean {
  const createFunctionStmt = stmt?.CreateFunctionStmt;
  if (!createFunctionStmt) return false;
  
  const language = getLanguageFromOptions(createFunctionStmt.options);
  return language === 'plpgsql';
}

function getStatementSql(sqlBuffer: Buffer, rawStmt: any): string {
  const start = rawStmt?.stmt_location ?? 0;
  const len = rawStmt?.stmt_len;
  const end = len !== undefined ? start + len : sqlBuffer.length;
  return sqlBuffer.slice(start, end).toString('utf8');
}

function extractFunctionInfo(stmt: any, stmtIndex: number, stmtSql: string): ParsedFunction | null {
  const createFunctionStmt = stmt?.CreateFunctionStmt;
  if (!createFunctionStmt) return null;
  
  const language = getLanguageFromOptions(createFunctionStmt.options);
  if (language !== 'plpgsql') return null;
  
  const body = getBodyFromOptions(createFunctionStmt.options);
  if (!body) return null;
  
  try {
    // Parse only this statement's SQL. Parsing the full script would return
    // every function's PL/pgSQL AST in plpgsql_funcs, and downstream deparse
    // pairs each statement with plpgsql_funcs[0].
    const plpgsqlRaw = parsePlPgSQLSync(stmtSql) as unknown as PLpgSQLParseResult;
    const { ast: hydrated, stats, errors } = hydratePlpgsqlAst(plpgsqlRaw);
    
    return {
      kind: 'plpgsql-function',
      stmt: createFunctionStmt,
      stmtIndex,
      language: language || 'plpgsql',
      body,
      plpgsql: {
        raw: plpgsqlRaw,
        hydrated,
        stats,
        errors
      }
    };
  } catch (err) {
    return null;
  }
}

export function parse(sql: string, options: ParseOptions = {}): ParsedScript {
  const { hydrate = true } = options;
  
  const sqlResult: ParseResult = parseSqlSync(sql);
  const items: ParsedItem[] = [];
  const functions: ParsedFunction[] = [];
  const sqlBuffer = Buffer.from(sql, 'utf8');
  
  if (sqlResult.stmts) {
    for (let i = 0; i < sqlResult.stmts.length; i++) {
      const rawStmt = sqlResult.stmts[i];
      const stmt = rawStmt?.stmt;
      
      if (stmt && isPlpgsqlFunction(stmt) && hydrate) {
        const fnInfo = extractFunctionInfo(stmt, i, getStatementSql(sqlBuffer, rawStmt));
        if (fnInfo) {
          items.push(fnInfo);
          functions.push(fnInfo);
          continue;
        }
      }
      
      const stmtItem: ParsedStatement = {
        kind: 'stmt',
        stmt,
        stmtIndex: i
      };
      items.push(stmtItem);
    }
  }
  
  return {
    sql: sqlResult,
    items,
    functions
  };
}

export function parseSync(sql: string, options: ParseOptions = {}): ParsedScript {
  return parse(sql, options);
}
