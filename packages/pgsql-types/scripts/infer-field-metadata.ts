import { parseSync, loadModule } from 'libpg-query';
import { runtimeSchema, NodeSpec, FieldSpec } from '../../utils/src/runtime-schema';
import * as fs from 'fs';
import * as path from 'path';

interface FieldMetadata {
  nullable: boolean;
  tags: string[];
  isArray: boolean;
}

interface NodeFieldMetadata {
  [fieldName: string]: FieldMetadata;
}

interface AllFieldMetadata {
  [nodeName: string]: NodeFieldMetadata;
}

const schemaMap = new Map<string, NodeSpec>(
  runtimeSchema.map((spec: NodeSpec) => [spec.name, spec])
);

function getNodeTypedFields(): Map<string, Map<string, FieldSpec>> {
  const nodeTypedFields = new Map<string, Map<string, FieldSpec>>();
  
  for (const nodeSpec of runtimeSchema) {
    const fieldsWithNodeType = new Map<string, FieldSpec>();
    for (const field of nodeSpec.fields) {
      if (field.type === 'Node') {
        fieldsWithNodeType.set(field.name, field);
      }
    }
    if (fieldsWithNodeType.size > 0) {
      nodeTypedFields.set(nodeSpec.name, fieldsWithNodeType);
    }
  }
  
  return nodeTypedFields;
}

function getNodeTag(value: any): string | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && /^[A-Z]/.test(keys[0])) {
      return keys[0];
    }
  }
  return null;
}

function inferNodeTags(value: any): string[] {
  const tags = new Set<string>();
  
  if (Array.isArray(value)) {
    for (const item of value) {
      const tag = getNodeTag(item);
      if (tag) {
        tags.add(tag);
      }
    }
  } else {
    const tag = getNodeTag(value);
    if (tag) {
      tags.add(tag);
    }
  }
  
  return Array.from(tags);
}

function walkAst(
  node: any,
  nodeTypedFields: Map<string, Map<string, FieldSpec>>,
  metadata: AllFieldMetadata
): void {
  if (!node || typeof node !== 'object') return;
  
  if (Array.isArray(node)) {
    for (const item of node) {
      walkAst(item, nodeTypedFields, metadata);
    }
    return;
  }
  
  const keys = Object.keys(node);
  if (keys.length === 1 && /^[A-Z]/.test(keys[0])) {
    const tag = keys[0];
    const nodeData = node[tag];
    
    const fieldsToTrack = nodeTypedFields.get(tag);
    if (fieldsToTrack) {
      if (!metadata[tag]) {
        metadata[tag] = {};
      }
      
      for (const [fieldName, fieldSpec] of fieldsToTrack) {
        if (!metadata[tag][fieldName]) {
          metadata[tag][fieldName] = {
            nullable: false,
            tags: [],
            isArray: fieldSpec.isArray
          };
        }
        
        const fieldValue = nodeData[fieldName];
        
        if (fieldValue == null) {
          metadata[tag][fieldName].nullable = true;
        } else {
          const inferredTags = inferNodeTags(fieldValue);
          for (const inferredTag of inferredTags) {
            if (!metadata[tag][fieldName].tags.includes(inferredTag)) {
              metadata[tag][fieldName].tags.push(inferredTag);
            }
          }
        }
      }
    }
    
    if (nodeData && typeof nodeData === 'object') {
      for (const key of Object.keys(nodeData)) {
        walkAst(nodeData[key], nodeTypedFields, metadata);
      }
    }
  } else {
    for (const key of keys) {
      walkAst(node[key], nodeTypedFields, metadata);
    }
  }
}

function findSqlFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.sql')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let inDollarQuote = false;
  let dollarTag = '';
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';
    
    if (inDollarQuote) {
      current += char;
      if (char === '$') {
        let endTag = '$';
        let j = i + 1;
        while (j < sql.length && sql[j] !== '$') {
          endTag += sql[j];
          j++;
        }
        if (j < sql.length) {
          endTag += '$';
          if (endTag === dollarTag) {
            current += sql.substring(i + 1, j + 1);
            i = j;
            inDollarQuote = false;
            dollarTag = '';
          }
        }
      }
    } else if (inString) {
      current += char;
      if (char === stringChar) {
        if (nextChar === stringChar) {
          current += nextChar;
          i++;
        } else {
          inString = false;
          stringChar = '';
        }
      }
    } else if (char === '$') {
      let tag = '$';
      let j = i + 1;
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) {
        tag += sql[j];
        j++;
      }
      if (j < sql.length && sql[j] === '$') {
        tag += '$';
        dollarTag = tag;
        inDollarQuote = true;
        current += sql.substring(i, j + 1);
        i = j;
      } else {
        current += char;
      }
    } else if (char === "'" || char === '"') {
      inString = true;
      stringChar = char;
      current += char;
    } else if (char === '-' && nextChar === '-') {
      while (i < sql.length && sql[i] !== '\n') {
        i++;
      }
    } else if (char === '/' && nextChar === '*') {
      i += 2;
      while (i < sql.length - 1 && !(sql[i] === '*' && sql[i + 1] === '/')) {
        i++;
      }
      i++;
    } else if (char === ';') {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }
  
  return statements;
}

async function main() {
  console.log('Loading WASM module...');
  await loadModule();
  
  const fixturesDir = path.resolve(__dirname, '../../../__fixtures__');
  const outputPath = path.resolve(__dirname, '../src/field-metadata.json');
  
  console.log('Finding SQL files...');
  const kitchenSinkDir = path.join(fixturesDir, 'kitchen-sink');
  const postgresDir = path.join(fixturesDir, 'postgres');
  
  const sqlFiles: string[] = [];
  
  if (fs.existsSync(kitchenSinkDir)) {
    sqlFiles.push(...findSqlFiles(kitchenSinkDir));
  }
  if (fs.existsSync(postgresDir)) {
    sqlFiles.push(...findSqlFiles(postgresDir));
  }
  
  console.log(`Found ${sqlFiles.length} SQL files`);
  
  const nodeTypedFields = getNodeTypedFields();
  console.log(`Found ${nodeTypedFields.size} node types with Node-typed fields`);
  
  const metadata: AllFieldMetadata = {};
  let totalStatements = 0;
  let successfulStatements = 0;
  let failedStatements = 0;
  
  for (const sqlFile of sqlFiles) {
    const content = fs.readFileSync(sqlFile, 'utf-8');
    const statements = splitStatements(content);
    
    for (const stmt of statements) {
      totalStatements++;
      try {
        const ast = parseSync(stmt);
        walkAst(ast, nodeTypedFields, metadata);
        successfulStatements++;
      } catch (e) {
        failedStatements++;
      }
    }
  }
  
  console.log(`Processed ${totalStatements} statements (${successfulStatements} successful, ${failedStatements} failed)`);
  
  for (const nodeName of Object.keys(metadata)) {
    for (const fieldName of Object.keys(metadata[nodeName])) {
      metadata[nodeName][fieldName].tags.sort();
    }
  }
  
  const sortedMetadata: AllFieldMetadata = {};
  for (const nodeName of Object.keys(metadata).sort()) {
    sortedMetadata[nodeName] = {};
    for (const fieldName of Object.keys(metadata[nodeName]).sort()) {
      sortedMetadata[nodeName][fieldName] = metadata[nodeName][fieldName];
    }
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(sortedMetadata, null, 2));
  console.log(`Wrote field metadata to ${outputPath}`);
  
  let totalFields = 0;
  let fieldsWithTags = 0;
  for (const nodeName of Object.keys(sortedMetadata)) {
    for (const fieldName of Object.keys(sortedMetadata[nodeName])) {
      totalFields++;
      if (sortedMetadata[nodeName][fieldName].tags.length > 0) {
        fieldsWithTags++;
      }
    }
  }
  
  console.log(`\nSummary:`);
  console.log(`  Total Node-typed fields discovered: ${totalFields}`);
  console.log(`  Fields with inferred tags: ${fieldsWithTags}`);
  console.log(`  Fields without tags (never seen populated): ${totalFields - fieldsWithTags}`);
}

main().catch(console.error);
