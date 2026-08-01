import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { parse } from '../src/';
import { cleanTree } from '../src/utils';

async function testAst() {
  try {
    // Read SQL from input.sql in the same directory
    const inputPath = join(__dirname, 'input.sql');
    const sql = readFileSync(inputPath, 'utf8');
    
    // Parse the SQL
    const ast = await parse(sql);
    const cleanedAst = cleanTree(ast);
    
    // Write JSON to output.json in the same directory
    const outputPath = join(__dirname, 'output.json');
    writeFileSync(outputPath, JSON.stringify(cleanedAst, null, 2));
    
    console.log(`Successfully parsed SQL from ${inputPath} and wrote AST to ${outputPath}`);
  } catch (error) {
    console.error('Error processing SQL:', error);
  }
}

testAst();