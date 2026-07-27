import { v13, v14, v15, v16, v17 } from '@pgsql/parser';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cleanTree } from '../test-utils/clean-tree';

async function testAst() {
  try {
    // Read SQL from input.sql in the same directory
    const inputPath = join(__dirname, 'input.sql');
    const sql = readFileSync(inputPath, 'utf8');
    
    // Parse the SQL
    const astv17 = await v17.parse(sql);
    const astv16 = await v16.parse(sql);
    const astv15 = await v15.parse(sql);
    const astv14 = await v14.parse(sql);
    const astv13 = await v13.parse(sql);
    
    const cleanedAstv17 = cleanTree(astv17);
    const cleanedAstv16 = cleanTree(astv16);
    const cleanedAstv15 = cleanTree(astv15);
    const cleanedAstv14 = cleanTree(astv14);
    const cleanedAstv13 = cleanTree(astv13);
    
    // Write JSON to output.json in the same directory
    const outputPathv13 = join(__dirname, 'output-v13.json');
    const outputPathv14 = join(__dirname, 'output-v14.json');
    const outputPathv15 = join(__dirname, 'output-v15.json');
    const outputPathv16 = join(__dirname, 'output-v16.json');
    const outputPathv17 = join(__dirname, 'output-v17.json');
    
    writeFileSync(outputPathv13, JSON.stringify(cleanedAstv13, null, 2));
    writeFileSync(outputPathv14, JSON.stringify(cleanedAstv14, null, 2));
    writeFileSync(outputPathv15, JSON.stringify(cleanedAstv15, null, 2));
    writeFileSync(outputPathv16, JSON.stringify(cleanedAstv16, null, 2));
    writeFileSync(outputPathv17, JSON.stringify(cleanedAstv17, null, 2));
    
    console.log(`Successfully parsed SQL from ${inputPath} and wrote AST`);
  } catch (error) {
    console.error('Error processing SQL:', error);
  }
}

testAst();