import * as t from '@babel/types';

import {NodeSpec } from '../runtime-schema/types';
import { toSpecialCamelCase } from './index';

/**
 * Converts an AST (Abstract Syntax Tree) representation of a SQL query into
 * a meta-level AST that represents the code to generate the original AST.
 * This meta-level AST can then be used to programmatically construct the AST
 * for similar SQL queries. Essentially, it's an AST that describes how to
 * build an AST, enabling dynamic code generation based on the structure of
 * the original SQL AST. 
 */

// TODO — handle TypeName and SPECIAL_TYPES cases



export function generateTsAstCodeFromPgAst(ast: any, runtimeSchema: NodeSpec[]): any {
  const schemaMap = new Map<string, NodeSpec>();
  runtimeSchema.forEach(spec => {
    schemaMap.set(spec.name, spec);
  });

  function createAstNode(functionName: string, properties: any, isWrapped: boolean = true) {
    const args = properties.map(([propKey, propValue]: [string, any]) => {
      if (propValue && typeof propValue === 'object' && propValue.type) {
        return t.objectProperty(t.identifier(propKey), propValue);
      }
      return t.objectProperty(t.identifier(propKey), getValueNode(propValue));
    });
        
    const builderPath = isWrapped ? 'nodes' : 'ast';
    return t.callExpression(
      t.memberExpression(
        t.memberExpression(t.identifier('t'), t.identifier(builderPath)),
        t.identifier(functionName)
      ),
      [t.objectExpression(args)]
    );
  }

  function getValueNode(value: any, parentNodeType?: string, fieldName?: string): t.Expression {
    if (Array.isArray(value)) {
      return t.arrayExpression(value.map(item => getValueNode(item, parentNodeType, fieldName)));
    } else if (typeof value === 'object') {
      if (value === null) return t.nullLiteral();
            
      if (parentNodeType && fieldName) {
        const parentSpec = schemaMap.get(parentNodeType);
        if (parentSpec) {
          const fieldSpec = parentSpec.fields.find(f => f.name === fieldName);

        }
      }
            
      return traverse(value, parentNodeType, fieldName);
    }
    switch (typeof value) {
    case 'boolean':
      return t.booleanLiteral(value);
    case 'number':
      return t.numericLiteral(value);
    case 'string':
      return t.stringLiteral(value);
    default:
      return t.stringLiteral(String(value)); // Fallback for other types
    }
  }

  function findNodeTypeByFields(fieldNames: string[]): NodeSpec | null {
    for (const nodeSpec of runtimeSchema) {
      const specFieldNames = nodeSpec.fields.map(f => f.name).sort();
      const sortedFieldNames = [...fieldNames].sort();
            
      const hasAllRequiredFields = specFieldNames.every(fieldName => 
        sortedFieldNames.includes(fieldName) || 
                nodeSpec.fields.find(f => f.name === fieldName)?.optional
      );
      const hasOnlyValidFields = sortedFieldNames.every(fieldName => 
        specFieldNames.includes(fieldName)
      );
            
      if (hasAllRequiredFields && hasOnlyValidFields && sortedFieldNames.length > 0) {
        return nodeSpec;
      }
    }
    return null;
  }

  function traverse(node: any, parentNodeType?: string, fieldName?: string): t.Expression {
    if (Array.isArray(node)) {
      return t.arrayExpression(node.map(item => traverse(item, parentNodeType, fieldName)));
    } else if (node && typeof node === 'object') {
      const entries = Object.entries(node);
      if (entries.length === 0) return t.objectExpression([]);

      if (entries.length === 1) {
        const [key, value] = entries[0];
        const functionName = toSpecialCamelCase(key);
                
        let isWrapped = true;
                
        if (parentNodeType && fieldName) {
          const parentSpec = schemaMap.get(parentNodeType);
          if (parentSpec) {
            const fieldSpec = parentSpec.fields.find(f => f.name === fieldName);
            if (fieldSpec && fieldSpec.type !== 'Node' && schemaMap.has(fieldSpec.type)) {
              isWrapped = false;
            }
          }
        }
                
        const processedProperties = Object.entries(value).map(([propKey, propValue]) => {
          return [propKey, getValueNode(propValue, key, propKey)];
        });
                
        return createAstNode(functionName, processedProperties, isWrapped);
      } else {
        const fieldNames = entries.map(([key]) => key);
        const matchingNodeSpec = findNodeTypeByFields(fieldNames);
                
        if (matchingNodeSpec) {
          const functionName = toSpecialCamelCase(matchingNodeSpec.name);
                    
          let isWrapped = true;
          if (parentNodeType && fieldName) {
            const parentSpec = schemaMap.get(parentNodeType);
            if (parentSpec) {
              const parentFieldSpec = parentSpec.fields.find(f => f.name === fieldName);
              if (parentFieldSpec && parentFieldSpec.type !== 'Node' && schemaMap.has(parentFieldSpec.type)) {
                isWrapped = false;
              }
            }
          }
                    
          const processedProperties = entries.map(([propKey, propValue]) => {
            return [propKey, traverse(propValue, matchingNodeSpec.name, propKey)];
          });
                    
          return createAstNode(functionName, processedProperties, isWrapped);
        } else {
          const properties = entries.map(([propKey, propValue]) => {
            return t.objectProperty(t.identifier(propKey), traverse(propValue, parentNodeType, propKey));
          });
          return t.objectExpression(properties);
        }
      }
    }

    return getValueNode(node, parentNodeType, fieldName);
  }

  return traverse(ast);
}
  