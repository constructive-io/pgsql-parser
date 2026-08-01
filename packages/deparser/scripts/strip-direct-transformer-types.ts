import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Script to strip types from direct transformer files and replace them with 'any'
 * Also removes overload signatures and adjusts imports to use generated versions
 */

const DIRECT_TRANSFORMER_FILES = [
  '../transform/src/transformers-direct/v13-to-v17/index.ts',
  '../transform/src/transformers-direct/v14-to-v17/index.ts',
  '../transform/src/transformers-direct/v15-to-v17/index.ts',
  '../transform/src/transformers-direct/v16-to-v17/index.ts'
];

const OUTPUT_DIR = 'versions/direct';

// Types to strip and replace with 'any'
const TYPES_TO_STRIP = [
  'PG13', 'PG14', 'PG15', 'PG16', 'PG17',
  'TransformerContext'
];

function stripTypes(sourceFile: ts.SourceFile, fileName: string): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    let hasTransformMethod = false;
    
    const visit: ts.Visitor = (node) => {
      // Update import paths to use generated versions
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const importPath = moduleSpecifier.text;
          
          // Remove imports for type modules
          if (importPath.includes('/types')) {
            return undefined;
          }
          
          // Update transformer imports to use versions directory
          if (importPath.includes('transformers/v')) {
            const transformerMatch = importPath.match(/transformers\/(v\d+-to-v\d+)/);
            if (transformerMatch) {
              const newPath = `./${transformerMatch[1]}`;
              return ts.factory.updateImportDeclaration(
                node,
                node.modifiers,
                node.importClause,
                ts.factory.createStringLiteral(newPath),
                node.assertClause
              );
            }
          }
        }
      }

      // Handle method declarations - remove overloads, keep implementation
      if (ts.isMethodDeclaration(node) && node.name && node.name.getText() === 'transform') {
        // If it's just a signature (no body), skip it
        if (!node.body) {
          return undefined;
        }
        
        hasTransformMethod = true;
        
        // Replace the implementation with 'any' types
        return ts.factory.updateMethodDeclaration(
          node,
          node.modifiers,
          node.asteriskToken,
          node.name,
          node.questionToken,
          node.typeParameters,
          node.parameters.map(param => 
            ts.factory.updateParameterDeclaration(
              param,
              param.modifiers,
              param.dotDotDotToken,
              param.name,
              param.questionToken,
              ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
              param.initializer
            )
          ),
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
          node.body
        );
      }

      // Replace type references with 'any'
      if (ts.isTypeReferenceNode(node)) {
        const typeName = node.typeName.getText();
        
        // Check if it's a qualified name (e.g., PG13.Node)
        if (typeName.includes('.')) {
          const [namespace] = typeName.split('.');
          if (TYPES_TO_STRIP.includes(namespace)) {
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
          }
        }
      }

      // Replace parameter type annotations
      if (ts.isParameter(node) && node.type) {
        const typeText = node.type.getText();
        if (TYPES_TO_STRIP.some(type => typeText.includes(type))) {
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
        if (TYPES_TO_STRIP.some(type => typeText.includes(type))) {
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
        if (TYPES_TO_STRIP.some(type => typeText.includes(type))) {
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

      // Replace type assertions
      if (ts.isAsExpression(node)) {
        const typeText = node.type.getText();
        if (TYPES_TO_STRIP.some(type => typeText.includes(type))) {
          return node.expression; // Remove the assertion entirely
        }
        // Also check for any 'as' expression that ends with .ParseResult or .Node
        if (typeText.match(/\.(ParseResult|Node)$/)) {
          return node.expression;
        }
      }

      // Handle property declarations with types
      if (ts.isPropertyDeclaration(node) && node.type) {
        const typeText = node.type.getText();
        if (TYPES_TO_STRIP.some(type => typeText.includes(type))) {
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

      return ts.visitEachChild(node, visit, context);
    };

    return (node) => ts.visitNode(node, visit) as ts.SourceFile;
  };

  const result = ts.transform(sourceFile, [transformer]);
  const transformedSourceFile = result.transformed[0];
  
  // Add header comment
  const headerComment = `/**
 * Auto-generated file with types stripped for better tree-shaking
 * DO NOT EDIT - Generated by strip-direct-transformer-types.ts
 */

`;
  
  let code = printer.printFile(transformedSourceFile);
  
  // Post-process to remove any remaining type references
  // Remove 'as PGxx.ParseResult' and 'as PGxx.Node' patterns
  code = code.replace(/\s+as\s+PG\d+\.(ParseResult|Node)/g, '');
  
  // Remove any remaining type casts with version types
  code = code.replace(/\s+as\s+(V\d+Types|PG\d+)\.[A-Za-z]+/g, '');
  
  return headerComment + code;
}

function processFile(filePath: string): void {
  console.log(`Processing ${filePath}...`);
  
  const fullPath = path.join(process.cwd(), filePath);
  const sourceCode = fs.readFileSync(fullPath, 'utf-8');
  
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );
  
  const strippedCode = stripTypes(sourceFile, filePath);
  
  // Create output directory if it doesn't exist
  const outputPath = path.join(process.cwd(), OUTPUT_DIR);
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  // Extract version info from path (e.g., v13-to-v17)
  const versionMatch = filePath.match(/v(\d+)-to-v(\d+)/);
  if (!versionMatch) {
    throw new Error(`Could not extract version info from ${filePath}`);
  }
  
  const outputFileName = `${versionMatch[0]}.ts`;
  const outputFilePath = path.join(outputPath, outputFileName);
  fs.writeFileSync(outputFilePath, strippedCode);
  
  console.log(`✓ Written to ${path.join(OUTPUT_DIR, outputFileName)}`);
}

function main() {
  console.log('Stripping types from direct transformer files...\n');
  
  for (const file of DIRECT_TRANSFORMER_FILES) {
    try {
      processFile(file);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }
  
  console.log('\nDone! Stripped direct transformer files are in the versions/direct/ directory.');
}

// Run the script
main();