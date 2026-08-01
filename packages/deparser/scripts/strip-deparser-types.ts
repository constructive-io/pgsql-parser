import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Script to strip types from deparser files and copy them to version directories
 * Replaces @pgsql/types imports and t.* type references with 'any'
 */

const DEPARSER_SRC_DIR = 'src';
const VERSIONS_DIR = 'versions';
const VERSIONS = [13, 14, 15, 16];

// Types to strip
const TYPES_TO_STRIP = ['Node', '@pgsql/types'];

function stripTypes(sourceFile: ts.SourceFile, fileName: string): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      // Remove or modify import declarations
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const importPath = moduleSpecifier.text;
          
          // Remove @pgsql/types imports entirely
          if (importPath === '@pgsql/types') {
            return undefined;
          }
        }
      }

      // Replace type references with 'any'
      if (ts.isTypeReferenceNode(node)) {
        const typeName = node.typeName.getText();
        
        // Replace Node type
        if (typeName === 'Node') {
          return ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
        }
        
        // Replace t.* types (e.g., t.SelectStmt, t.A_Const)
        if (typeName.startsWith('t.')) {
          return ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
        }
      }

      // Replace qualified names in property access (e.g., node as t.SelectStmt)
      if (ts.isPropertyAccessExpression(node)) {
        const expression = node.expression;
        if (ts.isIdentifier(expression) && expression.text === 't') {
          // This is a t.* reference, but in an expression context
          // We'll handle this in type assertions
        }
      }

      // Replace type assertions
      if (ts.isAsExpression(node)) {
        const typeText = node.type.getText();
        
        // Remove assertions with Node type
        if (typeText === 'Node') {
          return node.expression;
        }
        
        // Remove assertions with t.* types
        if (typeText.startsWith('t.')) {
          return node.expression;
        }
      }

      // Replace parameter type annotations
      if (ts.isParameter(node) && node.type) {
        const typeText = node.type.getText();
        if (typeText === 'Node' || typeText.startsWith('t.')) {
          return ts.factory.updateParameterDeclaration(
            node,
            node.modifiers,
            node.dotDotDotToken,
            node.name,
            node.questionToken,
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
            node.initializer
          );
        }
      }

      // Replace variable type annotations
      if (ts.isVariableDeclaration(node) && node.type) {
        const typeText = node.type.getText();
        if (typeText === 'Node' || typeText.startsWith('t.')) {
          return ts.factory.updateVariableDeclaration(
            node,
            node.name,
            node.exclamationToken,
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
            node.initializer
          );
        }
      }

      // Replace return type annotations
      if ((ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) && node.type) {
        const typeText = node.type.getText();
        if (typeText === 'Node' || typeText.startsWith('t.')) {
          if (ts.isMethodDeclaration(node)) {
            return ts.factory.updateMethodDeclaration(
              node,
              node.modifiers,
              node.asteriskToken,
              node.name,
              node.questionToken,
              node.typeParameters,
              node.parameters,
              ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
              node.body
            );
          } else if (ts.isFunctionDeclaration(node)) {
            return ts.factory.updateFunctionDeclaration(
              node,
              node.modifiers,
              node.asteriskToken,
              node.name,
              node.typeParameters,
              node.parameters,
              ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
              node.body
            );
          } else if (ts.isArrowFunction(node)) {
            return ts.factory.updateArrowFunction(
              node,
              node.modifiers,
              node.typeParameters,
              node.parameters,
              ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
              node.equalsGreaterThanToken,
              node.body
            );
          }
        }
      }

      // Handle property declarations with types
      if (ts.isPropertyDeclaration(node) && node.type) {
        const typeText = node.type.getText();
        if (typeText === 'Node' || typeText.startsWith('t.')) {
          return ts.factory.updatePropertyDeclaration(
            node,
            node.modifiers,
            node.name,
            node.questionToken || node.exclamationToken,
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
            node.initializer
          );
        }
      }

      // Handle interface declarations - convert to type alias with any
      if (ts.isInterfaceDeclaration(node)) {
        // Skip interfaces that extend from @pgsql/types
        const hasTypesExtension = node.heritageClauses?.some(clause => 
          clause.types.some(type => {
            const typeText = type.expression.getText();
            return typeText.startsWith('t.') || typeText === 'Node';
          })
        );
        
        if (hasTypesExtension) {
          // Convert interface to type alias = any
          return ts.factory.createTypeAliasDeclaration(
            node.modifiers,
            node.name,
            node.typeParameters,
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
          );
        }
      }

      return ts.visitEachChild(node, visit, context);
    };

    return (node) => ts.visitNode(node, visit) as ts.SourceFile;
  };

  const result = ts.transform(sourceFile, [transformer]);
  const transformedSourceFile = result.transformed[0];
  
  let code = printer.printFile(transformedSourceFile);
  
  // Post-process to clean up any remaining type references
  // Remove any remaining 'as t.*' patterns
  code = code.replace(/\s+as\s+t\.[A-Za-z_]+/g, '');
  
  // Remove any remaining 'as Node' patterns
  code = code.replace(/\s+as\s+Node/g, '');
  
  // Add header comment
  const headerComment = `/**
 * Auto-generated file with types stripped for better tree-shaking
 * DO NOT EDIT - Generated by strip-deparser-types.ts
 */

`;
  
  return headerComment + code;
}

function processFile(filePath: string, relativePath: string): string {
  console.log(`  Processing ${relativePath}...`);
  
  const sourceCode = fs.readFileSync(filePath, 'utf-8');
  
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );
  
  return stripTypes(sourceFile, filePath);
}

function copyDeparserToVersions(): void {
  console.log('Stripping types from deparser files and copying to version directories...\n');
  
  const deparserSrcPath = path.join(process.cwd(), DEPARSER_SRC_DIR);
  
  if (!fs.existsSync(deparserSrcPath)) {
    console.error(`Deparser source directory not found: ${deparserSrcPath}`);
    return;
  }
  
  // Get all TypeScript files in deparser src
  const files: string[] = [];
  
  function collectFiles(dir: string, baseDir: string = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(baseDir, entry.name);
      
      if (entry.isDirectory()) {
        collectFiles(fullPath, relativePath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(relativePath);
      }
    }
  }
  
  collectFiles(deparserSrcPath);
  
  console.log(`Found ${files.length} TypeScript files in deparser src\n`);
  
  // Process each version
  for (const version of VERSIONS) {
    console.log(`Processing version ${version}...`);
    
    const versionDeparserDir = path.join(VERSIONS_DIR, version.toString(), 'src', 'deparser');
    
    // Create deparser directory
    if (!fs.existsSync(versionDeparserDir)) {
      fs.mkdirSync(versionDeparserDir, { recursive: true });
    }
    
    // Process and copy each file
    for (const file of files) {
      const sourcePath = path.join(deparserSrcPath, file);
      const destPath = path.join(versionDeparserDir, file);
      
      // Create subdirectories if needed
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      // Process and write file
      const strippedCode = processFile(sourcePath, file);
      fs.writeFileSync(destPath, strippedCode);
    }
    
    console.log(`  ✓ Copied ${files.length} files to versions/${version}/deparser/\n`);
  }
  
  console.log('Done! Deparser files have been stripped and copied to all version directories.');
}

// Run the script
copyDeparserToVersions();