import { loadModule, parsePlPgSQLSync } from '@libpg-query/parser';
import * as fs from 'fs';
import * as path from 'path';
import { hydratePlpgsqlAst, dehydratePlpgsqlAst, PLpgSQLParseResult, deparseSync } from '../src';

describe('hydrate demonstration with big-function.sql', () => {
  beforeAll(async () => {
    await loadModule();
  });

  it('should parse, hydrate, modify, and deparse big-function.sql', () => {
    const fixturePath = path.join(__dirname, '../../../__fixtures__/plpgsql-pretty/big-function.sql');
    const sql = fs.readFileSync(fixturePath, 'utf-8');
    
    const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
    
    const { ast: hydratedAst, stats } = hydratePlpgsqlAst(parsed);
    
    expect(stats.totalExpressions).toBe(68);
    expect(stats.parsedExpressions).toBe(68);
    expect(stats.assignmentExpressions).toBe(20);
    expect(stats.sqlExpressions).toBe(48);
    expect(stats.failedExpressions).toBe(0);
    expect(stats.rawExpressions).toBe(0);
    
    const modifiedAst = modifyAst(JSON.parse(JSON.stringify(hydratedAst)));
    
    const dehydratedAst = dehydratePlpgsqlAst(modifiedAst);
    
    const deparsed = deparseSync(dehydratedAst);
    
    expect(deparsed).toContain('v_discount_MODIFIED');
    expect(deparsed).toContain('v_tax_MODIFIED');
    expect(deparsed).toContain('888');
    
    expect(deparsed).toMatchSnapshot();
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

function modifyAst(ast: any): any {
  let modCount = 0;
  let assignModCount = 0;
  
  function walk(node: any): void {
    if (node === null || node === undefined) return;
    
    if (typeof node === 'object') {
      if ('PLpgSQL_expr' in node) {
        const query = node.PLpgSQL_expr.query;
        
        if (typeof query === 'object' && query.kind === 'assign') {
          if (query.target === 'v_discount' && assignModCount === 0) {
            query.target = 'v_discount_MODIFIED';
            assignModCount++;
            modCount++;
          }
          if (query.target === 'v_tax' && assignModCount === 1) {
            query.target = 'v_tax_MODIFIED';
            assignModCount++;
            modCount++;
          }
          if (query.value === '0' && modCount < 5) {
            query.value = '999';
            modCount++;
          }
        }
        
        if (typeof query === 'object' && query.kind === 'sql-expr') {
          if (query.original === '0' && modCount < 8) {
            query.original = '888';
            modCount++;
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
