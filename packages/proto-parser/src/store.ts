import * as t from '@babel/types';
import { Enum, Field, Namespace, ReflectionObject,Service, Type } from '@launchql/protobufjs';
import { mkdirSync } from 'fs';
import { dirname,join } from 'path';
import { jsStringify } from 'strfy-js';

import { convertEnumToTsEnumDeclaration, convertEnumToTsUnionType, convertTypeToTsInterface,generateAstHelperMethods, generateEnumImports, generateEnumToIntFunctions, generateEnumToIntFunctionsNested, generateEnumToStringFunctions, generateEnumToStringFunctionsNested, generateEnumValueFunctions, generateNodeUnionType, generateTypeImportSpecifiers, generateWrappedAstHelperMethods } from './ast';
import { generateEnum2IntJSON, generateEnum2StrJSON } from './ast/enums/enums-json';
import { NODE_TYPE } from './constants';
import { nestedObjCode } from './inline-helpers';
import { getOptionsWithDefaults, PgProtoStoreOptions } from './options';
import { RuntimeSchemaGenerator } from './runtime-schema';
import { cloneAndNameNode, convertAstToCode, createDefaultImport, getUndefinedKey, hasUndefinedInitialValue, stripExtension, writeFileToDisk } from './utils';

interface IProtoStore {
  options: PgProtoStoreOptions;
  root: ReflectionObject;
  services: Service[];
  types: Type[];
  fields: Field[];
  enums: Enum[];
  namespaces: Namespace[];

  _parse(node: ReflectionObject): void;
}
export class ProtoStore implements IProtoStore {
  options: PgProtoStoreOptions;
  root: ReflectionObject;
  services: Service[];
  types: Type[];
  fields: Field[];
  enums: Enum[];
  namespaces: Namespace[];
  private _runtimeSchema?: any[];

  constructor(
    root: ReflectionObject,
    options: PgProtoStoreOptions = {} as PgProtoStoreOptions
  ) {
    this.options = getOptionsWithDefaults(options);

    this.root = root;
    this.services = [];
    this.types = [];
    this.fields = [];
    this.enums = [];
    this.namespaces = [];

    this._parse(this.root);
  }

  _parse(node: ReflectionObject, name: string = '') {
    if (node instanceof Service) {
      this.services.push(cloneAndNameNode(node, name));
    } else if (node instanceof Type) {
      this.types.push(cloneAndNameNode(node, name));
      node.fieldsArray.forEach(field => this.fields.push(field));
    } else if (node instanceof Enum) {
      this.enums.push(cloneAndNameNode(this._processEnum(node), name));
    }

    if (node instanceof Namespace) {
      this.namespaces.push(node);
      Object.entries(node.nested || {}).forEach(([key, child]) => {
        this._parse(child, key);
      });
    }
  }

  _processEnum(enumNode: Enum): Enum {
    const undefinedKey = getUndefinedKey(enumNode.name);
    const clone = cloneAndNameNode(enumNode, enumNode.name);
    if (!this.options.enums.removeUndefinedAt0 || !hasUndefinedInitialValue(enumNode)) {
      return clone;
    }

    const newValues: Record<string, number> = {};
    let decrement = 0;

    for (const [key, value] of Object.entries(enumNode.values)) {
      if (key === undefinedKey && value === 0) {
        decrement = 1;
        continue;
      }
      newValues[key] = (value as number) - decrement;
    }

    clone.values = newValues;
    return clone;
  }

  write() {
    // Ensure the output directory exists
    mkdirSync(this.options.outDir, { recursive: true });

    this.writeEnumMaps();
    this.writeTypes();
    this.writeEnums();
    this.writeUtilsEnums();
    this.writeAstHelpers();
    this.writeWrappedAstHelpers();
    this.writeRuntimeSchema();
  }

  writeEnumMaps() {
    if (!this.options.enums.enumMap?.enabled) {
      return;
    }

    const enumsToProcess = this.enumsToProcess();
    const enums2int = generateEnum2IntJSON(enumsToProcess);
    const enums2str = generateEnum2StrJSON(enumsToProcess);
    const format = this.options.enums.enumMap.format || 'json';

    if (format === 'json') {
      // Write plain JSON files
      if (this.options.enums.enumMap.toIntOutFile) {
        const filename = this.ensureCorrectExtension(this.options.enums.enumMap.toIntOutFile, '.json');
        this.writeFile(filename, JSON.stringify(enums2int, null, 2));
      }
      if (this.options.enums.enumMap.toStrOutFile) {
        const filename = this.ensureCorrectExtension(this.options.enums.enumMap.toStrOutFile, '.json');
        this.writeFile(filename, JSON.stringify(enums2str, null, 2));
      }
    } else if (format === 'ts') {
      // Write TypeScript files with exports
      if (this.options.enums.enumMap.toIntOutFile) {
        const tsContent = this.generateEnumMapTypeScript(enums2int, 'enumToIntMap', 'EnumToIntMap');
        const filename = this.ensureCorrectExtension(this.options.enums.enumMap.toIntOutFile, '.ts');
        this.writeFile(filename, tsContent);
      }
      if (this.options.enums.enumMap.toStrOutFile) {
        const tsContent = this.generateEnumMapTypeScript(enums2str, 'enumToStrMap', 'EnumToStrMap');
        const filename = this.ensureCorrectExtension(this.options.enums.enumMap.toStrOutFile, '.ts');
        this.writeFile(filename, tsContent);
      }
    }
  }

  allTypesExceptNode () {
    return this.types.filter(type => type.name !== NODE_TYPE);
  }

  typesToProcess () {
    return this.types
      .filter(type => type.name !== NODE_TYPE)
      .filter(type => !this.options.exclude.includes(type.name));
  }

  enumsToProcess () {
    return this.enums
      .filter(enm => !this.options.exclude.includes(enm.name));
  }

  writeTypes() {
    if (this.options.types.enabled) {
      const typesToProcess = this.typesToProcess();
      const enumsToProcess = this.enumsToProcess();
      const node = generateNodeUnionType(this.options, typesToProcess);
      const enumImports = generateEnumImports(enumsToProcess, this.options.types.enumsSource);
      const types = typesToProcess.reduce((m, type) => {
        return [...m, convertTypeToTsInterface(type, this.options)];
      }, []);
      const filename = this.ensureCorrectExtension(this.options.types.filename, '.ts');
      this.writeCodeToFile(filename, [
        enumImports,
        node,
        ...types
      ]);
    }
  }



  writeEnums() {
    if (this.options.enums.enabled) {
      const filename = this.ensureCorrectExtension(this.options.enums.filename, '.ts');
      this.writeCodeToFile(filename, 
        this.enumsToProcess().map(enm => this.options.enums.enumsAsTypeUnion ?
          convertEnumToTsUnionType(enm) :
          convertEnumToTsEnumDeclaration(enm)
        )
      );
    }
  }

  writeUtilsEnums() {
    if (this.options.utils.enums.enabled) {
      const enumsToProcess = this.enumsToProcess();
      const useNestedObjects = this.options.utils.enums.outputFormat === 'nestedObjects';
      
      if (this.options.utils.enums.unidirectional) {
        // Generate separate unidirectional functions
        const toIntGenerator = useNestedObjects ? generateEnumToIntFunctionsNested : generateEnumToIntFunctions;
        const toStringGenerator = useNestedObjects ? generateEnumToStringFunctionsNested : generateEnumToStringFunctions;
        
        const toIntCode = convertAstToCode(toIntGenerator(enumsToProcess));
        const toIntFilename = this.ensureCorrectExtension(this.options.utils.enums.toIntFilename, '.ts');
        this.writeFile(toIntFilename, toIntCode);
        
        const toStringCode = convertAstToCode(toStringGenerator(enumsToProcess));
        const toStringFilename = this.ensureCorrectExtension(this.options.utils.enums.toStringFilename, '.ts');
        this.writeFile(toStringFilename, toStringCode);
      } else {
        // Generate bidirectional function (original behavior)
        // Note: Nested objects format only supported for unidirectional functions
        const code = convertAstToCode(generateEnumValueFunctions(enumsToProcess));
        const filename = this.ensureCorrectExtension(this.options.utils.enums.filename, '.ts');
        this.writeFile(filename, code);
      }
    }
  }

  writeAstHelpers() {
    if (this.options.utils.astHelpers.enabled) {
      const imports = this.options.utils.astHelpers.inlineNestedObj ?
        createDefaultImport('_o', './' + stripExtension(this.options.utils.astHelpers.nestedObjFile)) :
        createDefaultImport('_o', 'nested-obj');

      const typesToProcess = this.typesToProcess();
      const code = convertAstToCode([
        imports,
        generateTypeImportSpecifiers(typesToProcess, this.options),
        generateAstHelperMethods(typesToProcess)
      ]);

      const filename = this.ensureCorrectExtension(this.options.utils.astHelpers.filename, '.ts');
      this.writeFile(filename, code);

      if (this.options.utils.astHelpers.inlineNestedObj) {
        const nestedObjFilename = this.ensureCorrectExtension(this.options.utils.astHelpers.nestedObjFile, '.ts');
        this.writeFile(nestedObjFilename, nestedObjCode);
      }
    }
  }

  writeWrappedAstHelpers() {
    if (this.options.utils.wrappedAstHelpers?.enabled) {
      const imports = createDefaultImport('_o', 'nested-obj');

      const typesToProcess = this.typesToProcess();
      const code = convertAstToCode([
        imports,
        generateTypeImportSpecifiers(typesToProcess, this.options),
        generateWrappedAstHelperMethods(typesToProcess)
      ]);

      const filename = this.ensureCorrectExtension(this.options.utils.wrappedAstHelpers.filename, '.ts');
      this.writeFile(filename, code);
    }
  }

  writeRuntimeSchema() {
    if (!this.options.runtimeSchema?.enabled) {
      return;
    }

    const generator = new RuntimeSchemaGenerator(this.root as Namespace);
    const nodeSpecs = generator.generateNodeSpecs();
    const format = this.options.runtimeSchema.format || 'json';
    const filename = this.options.runtimeSchema.filename || 'runtime-schema';

    if (format === 'json') {
      const jsonContent = JSON.stringify(nodeSpecs, null, 2);
      const correctedFilename = this.ensureCorrectExtension(filename, '.json');
      const outFile = join(this.options.outDir, correctedFilename);
      writeFileToDisk(outFile, jsonContent, this.options);
    } else if (format === 'typescript') {
      const tsContent = this.generateRuntimeSchemaTypeScript(nodeSpecs);
      const correctedFilename = this.ensureCorrectExtension(filename, '.ts');
      const outFile = join(this.options.outDir, correctedFilename);
      writeFileToDisk(outFile, tsContent, this.options);
    }
  }

  getRuntimeSchema() {
    if (!this._runtimeSchema) {
      const generator = new RuntimeSchemaGenerator(this.root as Namespace);
      this._runtimeSchema = generator.generateNodeSpecs();
    }
    return this._runtimeSchema;
  }



  generateRuntimeSchemaTypeScript(nodeSpecs: any[]): string {
    const interfaceDefinitions = [
      'export interface FieldSpec {',
      '  name: string;',
      '  type: string;',
      '  isArray: boolean;',
      '  optional: boolean;',
      '}',
      '',
      'export interface NodeSpec {',
      '  name: string;',
      '  isNode: boolean;',
      '  fields: FieldSpec[];',
      '}',
      ''
    ];

    const exportStatement = `export const runtimeSchema: NodeSpec[] = ${jsStringify(nodeSpecs, {
      space: 2,
      camelCase: true,
      quotes: 'single'
    })};`;

    return [
      ...interfaceDefinitions,
      exportStatement
    ].filter(Boolean).join('\n');
  }

  generateEnumMapTypeScript(enumMap: any, varName: string, typeName: string): string {
    const exportStatement = `export const ${varName} = ${jsStringify(enumMap, {
      space: 2,
      camelCase: false,  // Preserve enum casing
      quotes: 'single'
    })};`;

    const typeStatement = `export type ${typeName} = typeof ${varName};`;

    return [
      exportStatement,
      '',
      typeStatement
    ].filter(Boolean).join('\n');
  }

  ensureCorrectExtension(filename: string, expectedExt: string): string {
    if (!filename || !expectedExt) {
      return filename || '';
    }
    
    // Ensure expectedExt starts with a dot
    if (!expectedExt.startsWith('.')) {
      expectedExt = '.' + expectedExt;
    }
    
    const extMatch = filename.match(/(\.[^./\\]+)+$/);
    const currentExt = extMatch ? extMatch[0] : '';
    
    if (currentExt && currentExt !== expectedExt) {
      // Replace the current extension with the expected one
      return filename.slice(0, -currentExt.length) + expectedExt;
    } else if (!currentExt) {
      // No extension, add the expected one
      return filename + expectedExt;
    }
    // Extension is already correct
    return filename;
  }

  writeFile(filePath: string, content: string) {
    const fullPath = join(this.options.outDir, filePath);
    const dir = dirname(fullPath);
    mkdirSync(dir, { recursive: true });
    writeFileToDisk(fullPath, content, this.options);
  }

  writeCodeToFile(filename: string, nodes: t.Node[]) {
    const code = convertAstToCode(nodes);
    const correctedFilename = this.ensureCorrectExtension(filename, '.ts');
    const filePath = join(this.options.outDir, correctedFilename);
    writeFileToDisk(filePath, code, this.options);
  }

}

