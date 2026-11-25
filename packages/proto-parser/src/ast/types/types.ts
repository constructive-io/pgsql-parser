import * as t from '@babel/types';
import { Field,Type } from '@launchql/protobufjs';

import { NODE_TYPE } from '../../constants';
import { PgProtoParserOptions } from '../../options';
import { createNamedImport, createNamedImportAsSuffix, getFieldName, toSpecialCamelCase } from '../../utils';
import { resolveTypeName } from './utils';

/**
 * Generates import statements for types from a specified source module.
 * Can optionally add a suffix to imported type names (e.g., import { Type as TypeSuffix })
 * Used when types need to be imported into other generated files.
 */
export const generateTypeImports = (types: Type[], source: string, suffix?: string) => {
  return suffix ?
    createNamedImportAsSuffix(types.map(e => e.name), source, suffix) :
    createNamedImport(types.map(e => e.name), source);
};

/**
 * Generates helper factory methods for creating AST node instances.
 * Creates an object with camelCase methods for each type (e.g., selectStmt() for SelectStmt type).
 * Each method accepts optional initial values and returns the type directly.
 * Example output: { selectStmt: (_p?: SelectStmt) => SelectStmt }
 */
export const generateAstHelperMethods = (types: Type[]): t.ExportDefaultDeclaration => {
  const creators = types.map((type: Type) => {
    const typeName = type.name;
    const param = t.identifier('_p');
    param.optional = true;
    param.typeAnnotation = t.tsTypeAnnotation(t.tsTypeReference(t.identifier(typeName)));

    let init: any = [];

    // @ts-ignore
    const fields: Field[] = type.fields;
    const astNodeInit = t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier('_j'),
        t.tsAsExpression(
          t.objectExpression(init),
          t.tsTypeReference(t.identifier(typeName))
        )
      )
    ]);

    const setStatements = Object.entries(fields)
      .map(([fName, field]) => {
        const fieldName = getFieldName(field, fName);
        return t.expressionStatement(
          t.callExpression(
            t.memberExpression(t.identifier('_o'), t.identifier('set')),
            [
              t.identifier('_j'),
              t.stringLiteral(fieldName),
              t.optionalMemberExpression(
                t.identifier('_p'),
                t.identifier(fieldName),
                false,
                true
              )
            ]
          )
        );
      });

    // Ensures camel case
    const methodName = toSpecialCamelCase(typeName);

    // Create the method
    const method = t.objectMethod(
      'method',
      t.identifier(methodName),
      [param],
      t.blockStatement([
        astNodeInit,
        ...setStatements,
        t.returnStatement(t.identifier('_j'))
      ])
    );

    // Set return type to just the type
    method.returnType = t.tsTypeAnnotation(t.tsTypeReference(t.identifier(typeName)));
    
    return method;
  });

  return t.exportDefaultDeclaration(t.objectExpression(creators));
};

/**
 * Generates helper factory methods that return AST nodes wrapped in a type-specific object.
 * Creates an object with camelCase methods for each type (e.g., selectStmt() for SelectStmt type).
 * Each method accepts optional initial values and returns { TypeName: TypeInstance }.
 * Example output: { selectStmt: (_p?: SelectStmt) => { SelectStmt: SelectStmt } }
 */
export const generateWrappedAstHelperMethods = (types: Type[]): t.ExportDefaultDeclaration => {
  const creators = types.map((type: Type) => {
    const typeName = type.name;
    const param = t.identifier('_p');
    param.optional = true;
    param.typeAnnotation = t.tsTypeAnnotation(t.tsTypeReference(t.identifier(typeName)));

    let init: any = [];

    // @ts-ignore
    const fields: Field[] = type.fields;
    const astNodeInit = t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier('_j'),
        t.tsAsExpression(
          t.objectExpression(init),
          t.tsTypeReference(t.identifier(typeName))
        )
      )
    ]);

    const setStatements = Object.entries(fields)
      .map(([fName, field]) => {
        const fieldName = getFieldName(field, fName);
        return t.expressionStatement(
          t.callExpression(
            t.memberExpression(t.identifier('_o'), t.identifier('set')),
            [
              t.identifier('_j'),
              t.stringLiteral(fieldName),
              t.optionalMemberExpression(
                t.identifier('_p'),
                t.identifier(fieldName),
                false,
                true
              )
            ]
          )
        );
      });

    // Return the wrapped object
    const wrappedReturn = t.returnStatement(
      t.objectExpression([
        t.objectProperty(
          t.identifier(typeName),
          t.identifier('_j')
        )
      ])
    );

    // Ensures camel case
    const methodName = toSpecialCamelCase(typeName);

    // Create the method
    const method = t.objectMethod(
      'method',
      t.identifier(methodName),
      [param],
      t.blockStatement([
        astNodeInit,
        ...setStatements,
        wrappedReturn
      ])
    );

    // Set return type to the wrapped type
    const wrappedType = t.tsTypeLiteral([
      t.tsPropertySignature(
        t.identifier(typeName),
        t.tsTypeAnnotation(t.tsTypeReference(t.identifier(typeName)))
      )
    ]);
    
    method.returnType = t.tsTypeAnnotation(wrappedType);
    
    return method;
  });

  return t.exportDefaultDeclaration(t.objectExpression(creators));
};

/**
 * Generates a TypeScript union type named 'Node' that includes all AST node types.
 * Can generate either a simple union (Type1 | Type2 | ...) or wrapped objects ({ Type1: Type1 } | { Type2: Type2 } | ...)
 * based on the wrappedNodeTypeExport option. This is the main type used to represent any AST node.
 */
export const generateNodeUnionType = (
  options: PgProtoParserOptions,
  types: Type[]
) => {
  if (options.types.wrappedNodeTypeExport) {
    return generateNodeUnionTypeObjectKeys(types);
  }
  const unionTypeNames = types.map(type => t.tsTypeReference(t.identifier(type.name)));

  const unionTypeAlias = t.tsTypeAliasDeclaration(
    t.identifier(NODE_TYPE),
    null,
    t.tsUnionType(unionTypeNames)
  );

  return t.exportNamedDeclaration(unionTypeAlias, []);
};


/**
 * Generates a Node union type where each type is wrapped in an object with the type name as key.
 * Example output: type Node = { SelectStmt: SelectStmt } | { InsertStmt: InsertStmt } | ...
 * This format makes it easier to determine the specific type of a node at runtime.
 */
export const generateNodeUnionTypeObjectKeys = (types: Type[]) => {
  // Mapping types to TypeScript object type annotations
  const unionTypeNames = types.map(type => 
    t.tsTypeLiteral([
      t.tsPropertySignature(
        t.identifier(type.name),
        t.tsTypeAnnotation(t.tsTypeReference(t.identifier(type.name)))
      )
    ])
  );

  // Creating the TypeScript union type
  const unionTypeAlias = t.tsTypeAliasDeclaration(
    t.identifier(NODE_TYPE),
    null,
    t.tsUnionType(unionTypeNames)
  );

  // Exporting the union type declaration
  return t.exportNamedDeclaration(unionTypeAlias, []);
};




// TODO: why is the Field.rule missing in types, but there in the JSON?
interface FieldType extends Field {
  rule: string;
}

const extractTypeFieldsAsTsProperties = (
  type: Type,
  options: PgProtoParserOptions
) => {

  // @ts-ignore
  const fields: FieldType[] = type.fields;
  const properties =
    Object.entries(fields)
      .map(([fieldName, field]) => {
        const type = resolveTypeName(field.type);
        const fieldType = field.rule === 'repeated' ?
          t.tsArrayType(type) :
          type;
        const prop = t.tsPropertySignature(
          t.identifier(getFieldName(field, fieldName)),
          t.tsTypeAnnotation(fieldType)
        );
        prop.optional = options.types.optionalFields;
        return prop;
      });

  return properties;
};

/**
 * Converts a protobuf Type definition into a TypeScript interface declaration.
 * Handles field types, arrays (repeated fields), and optional fields based on options.
 * Example: Type "SelectStmt" with fields becomes: export interface SelectStmt { field1?: Type1; ... }
 */
export const convertTypeToTsInterface = (
  type: Type,
  options: PgProtoParserOptions
) => {
  const typeName = type.name;
  const properties = extractTypeFieldsAsTsProperties(type, options);

  const interfaceDecl = t.tsInterfaceDeclaration(
    t.identifier(typeName),
    null,
    [],
    t.tsInterfaceBody(properties)
  );

  // Wrap the interface declaration in an export statement
  return t.exportNamedDeclaration(interfaceDecl, []);
};


/**
 * Generates import specifiers for types from the configured types source.
 * Used in ast-helpers to import all the type definitions.
 * Example output: import { SelectStmt, InsertStmt, ... } from './types';
 */
export const generateTypeImportSpecifiers = (types: Type[], options: PgProtoParserOptions) => {
  const importSpecifiers = types.map(type =>
    t.importSpecifier(t.identifier(type.name), t.identifier(type.name))
  );

  const importDeclaration = t.importDeclaration(importSpecifiers, t.stringLiteral(options.utils.astHelpers.typesSource));
  return importDeclaration;
};
