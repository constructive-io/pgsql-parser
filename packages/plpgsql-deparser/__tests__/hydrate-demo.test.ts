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
    
    console.log('\n=== HYDRATION STATS ===');
    const { ast: hydratedAst, errors, stats } = hydratePlpgsqlAst(parsed);
    console.log('Total expressions:', stats.totalExpressions);
    console.log('Parsed expressions:', stats.parsedExpressions);
    console.log('Assignment expressions:', stats.assignmentExpressions);
    console.log('SQL expressions:', stats.sqlExpressions);
    console.log('Failed expressions:', stats.failedExpressions);
    console.log('Raw expressions:', stats.rawExpressions);
    
    if (errors.length > 0) {
      console.log('\nErrors:', errors.slice(0, 5));
    }
    
    console.log('\n=== SAMPLE HYDRATED EXPRESSIONS ===');
    const sampleExprs = collectHydratedExprs(hydratedAst, 5);
    sampleExprs.forEach((expr, i) => {
      console.log(`\n[${i + 1}] Kind: ${expr.kind}`);
      console.log(`    Original: "${expr.original}"`);
      if (expr.kind === 'assign') {
        console.log(`    Target: "${expr.target}"`);
        console.log(`    Value: "${expr.value}"`);
        console.log(`    Has targetExpr: ${!!expr.targetExpr}`);
        console.log(`    Has valueExpr: ${!!expr.valueExpr}`);
      } else if (expr.kind === 'sql-expr') {
        console.log(`    Has expr AST: ${!!expr.expr}`);
      }
    });
    
    console.log('\n=== MODIFYING AST ===');
    const modifiedAst = modifyAst(JSON.parse(JSON.stringify(hydratedAst)));
    
    console.log('\n=== DEHYDRATING MODIFIED AST ===');
    const dehydratedAst = dehydratePlpgsqlAst(modifiedAst);
    
    console.log('\n=== DEPARSING DEHYDRATED AST ===');
    const deparsed = deparseSync(dehydratedAst);
    
    console.log('\n=== VERIFICATION: Changes Applied ===');
    expect(deparsed).toContain('v_discount_MODIFIED');
    expect(deparsed).toContain('v_tax_MODIFIED');
    expect(deparsed).toContain('888');
    
    console.log('Found v_discount_MODIFIED:', deparsed.includes('v_discount_MODIFIED'));
    console.log('Found v_tax_MODIFIED:', deparsed.includes('v_tax_MODIFIED'));
    console.log('Found 888 (modified default values):', deparsed.includes('888'));
    
    console.log('\n=== DEPARSED OUTPUT (first 2000 chars) ===');
    console.log(deparsed.substring(0, 2000));
    
    expect(stats.totalExpressions).toBeGreaterThan(0);
    expect(stats.parsedExpressions).toBeGreaterThan(0);
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
            console.log(`  Modifying assignment target: "${query.target}" -> "v_discount_MODIFIED"`);
            query.target = 'v_discount_MODIFIED';
            assignModCount++;
            modCount++;
          }
          if (query.target === 'v_tax' && assignModCount === 1) {
            console.log(`  Modifying assignment target: "${query.target}" -> "v_tax_MODIFIED"`);
            query.target = 'v_tax_MODIFIED';
            assignModCount++;
            modCount++;
          }
          if (query.value === '0' && modCount < 5) {
            console.log(`  Modifying assignment value: "${query.value}" -> "999"`);
            query.value = '999';
            modCount++;
          }
        }
        
        if (typeof query === 'object' && query.kind === 'sql-expr') {
          if (query.original === '0' && modCount < 8) {
            console.log(`  Modifying sql-expr value: "${query.original}" -> "888"`);
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
  console.log(`  Total modifications: ${modCount}`);
  return ast;
}
