/**
 * Schema Rename Mapped Test
 * 
 * This test demonstrates schema renaming with a rename map that tracks all
 * schema references found during traversal. It reads a complex SQL fixture
 * file and snapshots both:
 * 1. The rename map (all schema references found)
 * 2. The final SQL output after transformation
 */

import { loadModule, parsePlPgSQLSync, parseSync } from '@libpg-query/parser';
import { Deparser } from 'pgsql-deparser';
import { hydratePlpgsqlAst, dehydratePlpgsqlAst, PLpgSQLParseResult, deparseSync } from '../src';
import { readFileSync } from 'fs';
import * as path from 'path';

const FIXTURE_PATH = path.join(__dirname, '../../../__fixtures__/plpgsql/plpgsql_schema_rename.sql');

interface SchemaReference {
  type: 'function_name' | 'return_type' | 'table_ref' | 'func_call' | 'relation' | 'type_name';
  schema: string;
  name: string;
  location: string;
}

interface SchemaRenameMap {
  [oldSchema: string]: {
    newSchema: string;
    references: SchemaReference[];
  };
}

describe('schema rename mapped', () => {
  let fixtureSQL: string;

  beforeAll(async () => {
    await loadModule();
    fixtureSQL = readFileSync(FIXTURE_PATH, 'utf-8');
  });

  /**
   * Collect schema references from SQL AST and optionally transform them.
   */
  function collectAndTransformSqlAst(
    node: any,
    schemaRenameMap: SchemaRenameMap,
    location: string
  ): void {
    if (node === null || node === undefined || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        collectAndTransformSqlAst(node[i], schemaRenameMap, `${location}[${i}]`);
      }
      return;
    }

    // Handle RangeVar nodes (table references like app_public.users)
    if ('RangeVar' in node) {
      const rangeVar = node.RangeVar;
      if (rangeVar.schemaname && schemaRenameMap[rangeVar.schemaname]) {
        const ref: SchemaReference = {
          type: 'table_ref',
          schema: rangeVar.schemaname,
          name: rangeVar.relname || 'unknown',
          location: `${location}.RangeVar`,
        };
        schemaRenameMap[rangeVar.schemaname].references.push(ref);
        rangeVar.schemaname = schemaRenameMap[rangeVar.schemaname].newSchema;
      }
    }

    // Handle direct relation references (INSERT/UPDATE/DELETE statements)
    if ('relation' in node && node.relation && typeof node.relation === 'object') {
      const relation = node.relation;
      if (relation.schemaname && schemaRenameMap[relation.schemaname]) {
        const ref: SchemaReference = {
          type: 'relation',
          schema: relation.schemaname,
          name: relation.relname || 'unknown',
          location: `${location}.relation`,
        };
        schemaRenameMap[relation.schemaname].references.push(ref);
        relation.schemaname = schemaRenameMap[relation.schemaname].newSchema;
      }
    }

    // Handle TypeName nodes (type references)
    if ('TypeName' in node) {
      const typeName = node.TypeName;
      if (Array.isArray(typeName.names) && typeName.names.length >= 2) {
        const firstNameNode = typeName.names[0];
        const schemaName = firstNameNode?.String?.sval;
        if (schemaName && schemaRenameMap[schemaName]) {
          const secondNameNode = typeName.names[1];
          const ref: SchemaReference = {
            type: 'type_name',
            schema: schemaName,
            name: secondNameNode?.String?.sval || 'unknown',
            location: `${location}.TypeName`,
          };
          schemaRenameMap[schemaName].references.push(ref);
          firstNameNode.String.sval = schemaRenameMap[schemaName].newSchema;
        }
      }
    }

    // Handle FuncCall nodes (function calls like app_public.get_tax_rate())
    if ('FuncCall' in node) {
      const funcCall = node.FuncCall;
      if (Array.isArray(funcCall.funcname) && funcCall.funcname.length >= 2) {
        const firstNameNode = funcCall.funcname[0];
        const schemaName = firstNameNode?.String?.sval;
        if (schemaName && schemaRenameMap[schemaName]) {
          const secondNameNode = funcCall.funcname[1];
          const ref: SchemaReference = {
            type: 'func_call',
            schema: schemaName,
            name: secondNameNode?.String?.sval || 'unknown',
            location: `${location}.FuncCall`,
          };
          schemaRenameMap[schemaName].references.push(ref);
          firstNameNode.String.sval = schemaRenameMap[schemaName].newSchema;
        }
      }
    }

    // Handle CreateFunctionStmt funcname
    if ('CreateFunctionStmt' in node) {
      const createFunc = node.CreateFunctionStmt;
      if (Array.isArray(createFunc.funcname) && createFunc.funcname.length >= 2) {
        const firstNameNode = createFunc.funcname[0];
        const schemaName = firstNameNode?.String?.sval;
        if (schemaName && schemaRenameMap[schemaName]) {
          const secondNameNode = createFunc.funcname[1];
          const ref: SchemaReference = {
            type: 'function_name',
            schema: schemaName,
            name: secondNameNode?.String?.sval || 'unknown',
            location: `${location}.CreateFunctionStmt.funcname`,
          };
          schemaRenameMap[schemaName].references.push(ref);
          firstNameNode.String.sval = schemaRenameMap[schemaName].newSchema;
        }
      }
    }

    // Handle direct type references (returnType in CreateFunctionStmt)
    if ('names' in node && 'typemod' in node && Array.isArray(node.names) && node.names.length >= 2) {
      const firstNameNode = node.names[0];
      const schemaName = firstNameNode?.String?.sval;
      if (schemaName && schemaRenameMap[schemaName]) {
        const secondNameNode = node.names[1];
        const ref: SchemaReference = {
          type: 'return_type',
          schema: schemaName,
          name: secondNameNode?.String?.sval || 'unknown',
          location: `${location}.returnType`,
        };
        schemaRenameMap[schemaName].references.push(ref);
        firstNameNode.String.sval = schemaRenameMap[schemaName].newSchema;
      }
    }

    // Recurse into all object properties
    for (const [key, value] of Object.entries(node)) {
      collectAndTransformSqlAst(value, schemaRenameMap, `${location}.${key}`);
    }
  }

  /**
   * Collect schema references from hydrated PL/pgSQL AST and transform them.
   */
  function collectAndTransformPlpgsqlAst(
    node: any,
    schemaRenameMap: SchemaRenameMap,
    location: string
  ): void {
    if (node === null || node === undefined || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        collectAndTransformPlpgsqlAst(node[i], schemaRenameMap, `${location}[${i}]`);
      }
      return;
    }

    // Handle PLpgSQL_expr nodes with hydrated queries
    if ('PLpgSQL_expr' in node) {
      const expr = node.PLpgSQL_expr;
      const query = expr.query;

      if (query && typeof query === 'object' && 'kind' in query) {
        if (query.kind === 'sql-stmt' && query.parseResult) {
          collectAndTransformSqlAst(query.parseResult, schemaRenameMap, `${location}.PLpgSQL_expr.query.parseResult`);
        }
        if (query.kind === 'sql-expr' && query.expr) {
          collectAndTransformSqlAst(query.expr, schemaRenameMap, `${location}.PLpgSQL_expr.query.expr`);
        }
        if (query.kind === 'assign') {
          if (query.targetExpr) {
            collectAndTransformSqlAst(query.targetExpr, schemaRenameMap, `${location}.PLpgSQL_expr.query.targetExpr`);
          }
          if (query.valueExpr) {
            collectAndTransformSqlAst(query.valueExpr, schemaRenameMap, `${location}.PLpgSQL_expr.query.valueExpr`);
          }
        }
      }
    }

    // Handle PLpgSQL_type nodes (variable type declarations)
    // With hydration, the typname is now a HydratedTypeName object with a typeNameNode
    // that can be transformed using the SQL AST visitor
    if ('PLpgSQL_type' in node) {
      const plType = node.PLpgSQL_type;
      if (plType.typname && typeof plType.typname === 'object' && plType.typname.kind === 'type-name') {
        // Transform the TypeName AST node using the SQL visitor
        collectAndTransformSqlAst(plType.typname.typeNameNode, schemaRenameMap, `${location}.PLpgSQL_type.typname`);
      } else if (plType.typname && typeof plType.typname === 'string') {
        // Fallback for non-hydrated typnames (simple types without schema qualification)
        for (const oldSchema of Object.keys(schemaRenameMap)) {
          if (plType.typname.startsWith(oldSchema + '.')) {
            const typeName = plType.typname.substring(oldSchema.length + 1);
            const ref: SchemaReference = {
              type: 'type_name',
              schema: oldSchema,
              name: typeName,
              location: `${location}.PLpgSQL_type.typname`,
            };
            schemaRenameMap[oldSchema].references.push(ref);
            plType.typname = schemaRenameMap[oldSchema].newSchema + '.' + typeName;
            break;
          }
        }
      }
    }

    // Recurse into all object properties
    for (const [key, value] of Object.entries(node)) {
      collectAndTransformPlpgsqlAst(value, schemaRenameMap, `${location}.${key}`);
    }
  }

  /**
   * Transform a single SQL statement with schema renaming.
   */
  function transformStatement(
    sql: string,
    schemaRenameMap: SchemaRenameMap,
    stmtIndex: number
  ): string {
    const sqlParsed = parseSync(sql) as any;
    
    // Check if this is a PL/pgSQL function/procedure
    const stmt = sqlParsed.stmts[0]?.stmt;
    const isPlpgsql = stmt?.CreateFunctionStmt?.options?.some(
      (opt: any) => opt.DefElem?.defname === 'language' && 
        opt.DefElem?.arg?.String?.sval?.toLowerCase() === 'plpgsql'
    );

    // Transform outer SQL AST
    collectAndTransformSqlAst(sqlParsed, schemaRenameMap, `stmt[${stmtIndex}]`);

    if (isPlpgsql) {
      try {
        const plpgsqlParsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
        const { ast: hydratedAst } = hydratePlpgsqlAst(plpgsqlParsed);

        // Transform PL/pgSQL AST
        collectAndTransformPlpgsqlAst(hydratedAst, schemaRenameMap, `stmt[${stmtIndex}].plpgsql`);

        // Dehydrate and deparse
        const dehydratedAst = dehydratePlpgsqlAst(hydratedAst);
        const newBody = deparseSync(dehydratedAst);

        // Stitch body back into SQL AST
        const createFunctionStmt = sqlParsed.stmts[0].stmt.CreateFunctionStmt;
        const asOption = createFunctionStmt?.options?.find(
          (opt: any) => opt.DefElem?.defname === 'as'
        );
        if (asOption?.DefElem?.arg?.List?.items?.[0]?.String) {
          asOption.DefElem.arg.List.items[0].String.sval = newBody;
        }
      } catch (err) {
        // If PL/pgSQL parsing fails, just use the SQL AST transformation
        console.warn(`PL/pgSQL parsing failed for statement ${stmtIndex}:`, err);
      }
    }

    return Deparser.deparse(sqlParsed.stmts[0].stmt);
  }

  /**
   * Split SQL file into individual statements.
   * Handles dollar-quoted strings and skips comment-only lines.
   */
  function splitStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inDollarQuote = false;
    let dollarTag = '';
    let inLineComment = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];

      // Handle line comments
      if (!inDollarQuote && char === '-' && sql[i + 1] === '-') {
        inLineComment = true;
        current += char;
        continue;
      }
      if (inLineComment && char === '\n') {
        inLineComment = false;
        current += char;
        continue;
      }
      if (inLineComment) {
        current += char;
        continue;
      }

      current += char;

      // Handle dollar quotes
      if (char === '$' && !inDollarQuote) {
        let tag = '$';
        let j = i + 1;
        while (j < sql.length && (sql[j].match(/[a-zA-Z0-9_]/) || sql[j] === '$')) {
          tag += sql[j];
          if (sql[j] === '$') {
            j++;
            break;
          }
          j++;
        }
        if (tag.endsWith('$') && tag.length >= 2) {
          inDollarQuote = true;
          dollarTag = tag;
          current += sql.slice(i + 1, j);
          i = j - 1;
        }
      } else if (inDollarQuote && char === '$') {
        // Check for closing tag
        const remaining = sql.slice(i);
        if (remaining.startsWith(dollarTag)) {
          current += dollarTag.slice(1);
          i += dollarTag.length - 1;
          inDollarQuote = false;
          dollarTag = '';
        }
      } else if (!inDollarQuote && char === ';') {
        const trimmed = current.trim();
        // Remove leading comment lines and check if there's actual SQL
        const withoutComments = trimmed.replace(/^(--[^\n]*\n\s*)+/, '').trim();
        if (withoutComments.length > 0) {
          statements.push(trimmed);
        }
        current = '';
      }
    }

    // Handle last statement without semicolon
    const trimmed = current.trim();
    const withoutComments = trimmed.replace(/^(--[^\n]*\n\s*)+/, '').trim();
    if (withoutComments.length > 0) {
      statements.push(trimmed);
    }

    return statements;
  }

  it('should transform schema names and snapshot schema rename map and output', () => {
    // Define the schema rename map with schemas to transform
    const schemaRenameMap: SchemaRenameMap = {
      'app_public': {
        newSchema: 'myapp_v2',
        references: [],
      },
      'app_private': {
        newSchema: 'myapp_private_v2',
        references: [],
      },
      'app_internal': {
        newSchema: 'myapp_internal_v2',
        references: [],
      },
    };

    // Split fixture into individual statements
    const statements = splitStatements(fixtureSQL);
    expect(statements.length).toBeGreaterThan(0);

    // Transform each statement
    const transformedStatements: string[] = [];
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      // Skip comment-only statements (after removing leading comments)
      const withoutLeadingComments = stmt.replace(/^(--[^\n]*\n\s*)+/, '').trim();
      if (!withoutLeadingComments || withoutLeadingComments.startsWith('--')) {
        continue;
      }
      try {
        const transformed = transformStatement(stmt, schemaRenameMap, i);
        transformedStatements.push(transformed);
      } catch (err) {
        // Log the error for debugging
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`Failed to transform statement ${i}: ${errMsg}`);
        transformedStatements.push(`-- TRANSFORM FAILED: ${stmt.substring(0, 100)}...`);
      }
    }

    // Create a summary of the schema rename map (without location details for cleaner snapshot)
    const schemaRenameMapSummary: Record<string, { newSchema: string; referenceCount: number; references: Array<{ type: string; name: string }> }> = {};
    for (const [oldSchema, data] of Object.entries(schemaRenameMap)) {
      schemaRenameMapSummary[oldSchema] = {
        newSchema: data.newSchema,
        referenceCount: data.references.length,
        references: data.references.map(r => ({ type: r.type, name: r.name })),
      };
    }

    // Snapshot the schema rename map
    expect(schemaRenameMapSummary).toMatchSnapshot('schema-rename-map');

    // Snapshot the transformed SQL
    const finalSQL = transformedStatements.join(';\n\n') + ';';
    expect(finalSQL).toMatchSnapshot('transformed-sql');

    // Verify no old schema references remain in output
    expect(finalSQL).not.toMatch(/\bapp_public\./);
    expect(finalSQL).not.toMatch(/\bapp_private\./);
    expect(finalSQL).not.toMatch(/\bapp_internal\./);

    // Verify new schema references are present
    expect(finalSQL).toContain('myapp_v2.');
  });
});
