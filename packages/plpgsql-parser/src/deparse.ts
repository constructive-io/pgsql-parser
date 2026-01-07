import { deparse as deparseSql } from 'pgsql-deparser';
import {
  dehydratePlpgsqlAst,
  deparseSync as deparsePlpgsql,
  deparseFunctionSync as deparsePlpgsqlFunction
} from 'plpgsql-deparser';
import type {
  ParsedScript,
  TransformContext,
  DeparseOptions,
  ParsedFunction
} from './types';
import { getReturnInfoFromParsedFunction } from './return-info';

function stitchBodyIntoSqlAst(
  sqlAst: any,
  fn: ParsedFunction,
  newBody: string
): void {
  const stmts = sqlAst.stmts;
  if (!stmts || !stmts[fn.stmtIndex]) return;
  
  const rawStmt = stmts[fn.stmtIndex];
  const createFunctionStmt = rawStmt?.stmt?.CreateFunctionStmt;
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

export async function deparse(
  input: ParsedScript | TransformContext,
  options: DeparseOptions = {}
): Promise<string> {
  const { pretty = true } = options;
  
  const sqlAst = input.sql;
  const functions = input.functions;
  
  for (const fn of functions) {
    const dehydrated = dehydratePlpgsqlAst(fn.plpgsql.hydrated);
    const returnInfo = getReturnInfoFromParsedFunction(fn);
    const plpgsqlFunc = dehydrated.plpgsql_funcs?.[0]?.PLpgSQL_function;
    if (plpgsqlFunc) {
      const newBody = deparsePlpgsqlFunction(plpgsqlFunc, undefined, returnInfo);
      stitchBodyIntoSqlAst(sqlAst, fn, newBody);
    }
  }
  
  if (sqlAst.stmts && sqlAst.stmts.length > 0) {
    const results: string[] = [];
    for (const rawStmt of sqlAst.stmts) {
      if (rawStmt?.stmt) {
        const deparsed = await deparseSql(rawStmt.stmt, { pretty });
        results.push(deparsed);
      }
    }
    return results.join(';\n\n') + (results.length > 0 ? ';' : '');
  }
  
  return '';
}

export function deparseSync(
  input: ParsedScript | TransformContext,
  options: DeparseOptions = {}
): string {
  const { pretty = true } = options;
  
  const sqlAst = input.sql;
  const functions = input.functions;
  
  for (const fn of functions) {
    const dehydrated = dehydratePlpgsqlAst(fn.plpgsql.hydrated);
    const returnInfo = getReturnInfoFromParsedFunction(fn);
    const plpgsqlFunc = dehydrated.plpgsql_funcs?.[0]?.PLpgSQL_function;
    if (plpgsqlFunc) {
      const newBody = deparsePlpgsqlFunction(plpgsqlFunc, undefined, returnInfo);
      stitchBodyIntoSqlAst(sqlAst, fn, newBody);
    }
  }
  
  if (sqlAst.stmts && sqlAst.stmts.length > 0) {
    const results: string[] = [];
    for (const rawStmt of sqlAst.stmts) {
      if (rawStmt?.stmt) {
        const { Deparser } = require('pgsql-deparser');
        const deparsed = Deparser.deparse(rawStmt.stmt, { pretty });
        results.push(deparsed);
      }
    }
    return results.join(';\n\n') + (results.length > 0 ? ';' : '');
  }
  
  return '';
}
