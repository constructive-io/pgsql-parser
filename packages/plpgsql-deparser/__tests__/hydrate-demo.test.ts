import { loadModule, parsePlPgSQLSync, parseSync } from '@libpg-query/parser';
import { deparse } from 'pgsql-deparser';
import * as fs from 'fs';
import * as path from 'path';
import { hydratePlpgsqlAst, dehydratePlpgsqlAst, PLpgSQLParseResult, deparseSync } from '../src';

describe('hydrate demonstration with big-function.sql', () => {
  beforeAll(async () => {
    await loadModule();
  });

  it('should parse, hydrate, modify, and deparse big-function.sql with full CREATE FUNCTION', async () => {
    const fixturePath = path.join(__dirname, '../../../__fixtures__/plpgsql-pretty/big-function.sql');
    const sql = fs.readFileSync(fixturePath, 'utf-8');
    
    const sqlParsed = parseSync(sql) as any;
    const createFunctionStmt = sqlParsed.stmts[0].stmt.CreateFunctionStmt;
    
    const asOption = createFunctionStmt.options.find(
      (opt: any) => opt.DefElem?.defname === 'as'
    );
    const plpgsqlBody = asOption?.DefElem?.arg?.List?.items?.[0]?.String?.sval;
    
    expect(plpgsqlBody).toBeDefined();
    
    const plpgsqlParsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
    
    const { ast: hydratedAst, stats } = hydratePlpgsqlAst(plpgsqlParsed);
    
    expect(stats.totalExpressions).toBe(68);
    expect(stats.parsedExpressions).toBe(68);
    expect(stats.assignmentExpressions).toBe(20);
    expect(stats.sqlExpressions).toBe(48);
    expect(stats.failedExpressions).toBe(0);
    expect(stats.rawExpressions).toBe(0);
    
    createFunctionStmt.funcname[1].String.sval = 'order_rollup_calculator';
    
    const modifiedPlpgsqlAst = modifyAst(JSON.parse(JSON.stringify(hydratedAst)));
    
    const dehydratedAst = dehydratePlpgsqlAst(modifiedPlpgsqlAst);
    
    const modifiedBody = deparseSync(dehydratedAst);
    
    if (asOption?.DefElem?.arg?.List?.items?.[0]?.String) {
      asOption.DefElem.arg.List.items[0].String.sval = modifiedBody;
    }
    
    const fullDeparsed = await deparse(sqlParsed.stmts[0].stmt, { pretty: true });
    
    expect(fullDeparsed).toContain('order_rollup_calculator');
    expect(fullDeparsed).toContain('RETURNS TABLE');
    expect(fullDeparsed).toContain('CREATE OR REPLACE FUNCTION');
    expect(fullDeparsed).toContain('v_rebate');
    expect(fullDeparsed).toContain('v_levy');
    expect(fullDeparsed).toContain('42');
    
    expect(fullDeparsed).toMatchSnapshot();
  });
});

function collectHydratedExprs(obj: any, limit: number): any[] {
  const results: any[] = [];
  
  function walk(node: any): void {
    if (results.length >= limit) return;
    if (node === null || node === undefined) return;
    
    if (typeof node === 'object') {
      if ('PLpgSQL_expr' in node) {
        const query = node.PLpgSQL_expr.query;
        if (query && typeof query === 'object' && 'kind' in query) {
          results.push(query);
        }
      }
      
      for (const value of Object.values(node)) {
        walk(value);
      }
    }
    
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
    }
  }
  
  walk(obj);
  return results;
}

/**
 * Modify AST nodes directly (not string fields).
 * This demonstrates the proper way to transform hydrated PL/pgSQL ASTs.
 * 
 * For assign kind: modify targetExpr/valueExpr AST nodes
 * For sql-expr kind: modify expr AST node
 * For sql-stmt kind: modify parseResult AST
 */
function modifyAst(ast: any): any {
  let modCount = 0;
  let assignModCount = 0;
  
  function walk(node: any): void {
    if (node === null || node === undefined) return;
    
    if (typeof node === 'object') {
      if ('PLpgSQL_expr' in node) {
        const query = node.PLpgSQL_expr.query;
        
        if (typeof query === 'object' && query.kind === 'assign') {
          // Modify targetExpr AST node (not the string field)
          // targetExpr is a ColumnRef with fields array containing String nodes
          if (query.target === 'v_discount' && query.targetExpr && assignModCount === 0) {
            // ColumnRef structure: { ColumnRef: { fields: [{ String: { sval: 'v_discount' } }] } }
            if (query.targetExpr.ColumnRef?.fields?.[0]?.String) {
              query.targetExpr.ColumnRef.fields[0].String.sval = 'v_rebate';
              assignModCount++;
              modCount++;
            }
          }
          if (query.target === 'v_tax' && query.targetExpr && assignModCount === 1) {
            if (query.targetExpr.ColumnRef?.fields?.[0]?.String) {
              query.targetExpr.ColumnRef.fields[0].String.sval = 'v_levy';
              assignModCount++;
              modCount++;
            }
          }
          // Modify valueExpr AST node for integer constants
          // A_Const structure: { A_Const: { ival: { ival: 0 } } } or { A_Const: { sval: { sval: '0' } } }
          if (query.value === '0' && query.valueExpr && modCount < 5) {
            if (query.valueExpr.A_Const?.ival !== undefined) {
              query.valueExpr.A_Const.ival.ival = 42;
              modCount++;
            } else if (query.valueExpr.A_Const?.sval !== undefined) {
              query.valueExpr.A_Const.sval.sval = '42';
              modCount++;
            }
          }
        }
        
        if (typeof query === 'object' && query.kind === 'sql-expr') {
          // Modify expr AST node for integer constants
          if (query.original === '0' && query.expr && modCount < 8) {
            if (query.expr.A_Const?.ival !== undefined) {
              query.expr.A_Const.ival.ival = 42;
              modCount++;
            } else if (query.expr.A_Const?.sval !== undefined) {
              query.expr.A_Const.sval.sval = '42';
              modCount++;
            }
          }
        }
      }
      
      for (const value of Object.values(node)) {
        walk(value);
      }
    }
    
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
    }
  }
  
  walk(ast);
  return ast;
}
