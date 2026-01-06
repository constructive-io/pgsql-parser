/**
 * Schema Transform Demo
 * 
 * This test demonstrates the heterogeneous AST transformation pipeline:
 * 1. Parse SQL containing PL/pgSQL functions
 * 2. Hydrate embedded SQL expressions into AST nodes
 * 3. Traverse and transform schema names in both:
 *    - Outer SQL AST (CreateFunctionStmt, return types, etc.)
 *    - Embedded SQL inside PL/pgSQL function bodies
 * 4. Dehydrate back to strings
 * 5. Deparse to final SQL output
 * 
 * This pattern is useful for:
 * - Schema renaming (e.g., old_schema -> new_schema)
 * - Identifier rewriting
 * - Cross-cutting AST transformations
 */

import { loadModule, parsePlPgSQLSync, parseSync } from '@libpg-query/parser';
import { Deparser } from 'pgsql-deparser';
import { hydratePlpgsqlAst, dehydratePlpgsqlAst, PLpgSQLParseResult, deparseSync } from '../src';

describe('schema transform demo', () => {
  beforeAll(async () => {
    await loadModule();
  });

  /**
   * Transform schema names in SQL AST nodes.
   * Handles RangeVar, TypeName, FuncCall, and other schema-qualified references.
   */
  function transformSchemaInSqlAst(
    node: any,
    oldSchema: string,
    newSchema: string
  ): void {
    if (node === null || node === undefined || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        transformSchemaInSqlAst(item, oldSchema, newSchema);
      }
      return;
    }

    // Handle RangeVar nodes (table references like old_schema.users)
    if ('RangeVar' in node) {
      const rangeVar = node.RangeVar;
      if (rangeVar.schemaname === oldSchema) {
        rangeVar.schemaname = newSchema;
      }
    }

    // Handle direct relation references (INSERT/UPDATE/DELETE statements)
    // These have schemaname directly on the relation object, not wrapped in RangeVar
    if ('relation' in node && node.relation && typeof node.relation === 'object') {
      const relation = node.relation;
      if (relation.schemaname === oldSchema) {
        relation.schemaname = newSchema;
      }
    }

    // Handle TypeName nodes (type references like old_schema.my_type)
    if ('TypeName' in node) {
      const typeName = node.TypeName;
      if (Array.isArray(typeName.names) && typeName.names.length >= 2) {
        const firstNameNode = typeName.names[0];
        if (firstNameNode?.String?.sval === oldSchema) {
          firstNameNode.String.sval = newSchema;
        }
      }
    }

    // Handle FuncCall nodes (function calls like old_schema.my_func())
    if ('FuncCall' in node) {
      const funcCall = node.FuncCall;
      if (Array.isArray(funcCall.funcname) && funcCall.funcname.length >= 2) {
        const firstNameNode = funcCall.funcname[0];
        if (firstNameNode?.String?.sval === oldSchema) {
          firstNameNode.String.sval = newSchema;
        }
      }
    }

    // Handle CreateFunctionStmt funcname (CREATE FUNCTION old_schema.my_func)
    if ('CreateFunctionStmt' in node) {
      const createFunc = node.CreateFunctionStmt;
      if (Array.isArray(createFunc.funcname) && createFunc.funcname.length >= 2) {
        const firstNameNode = createFunc.funcname[0];
        if (firstNameNode?.String?.sval === oldSchema) {
          firstNameNode.String.sval = newSchema;
        }
      }
    }

    // Handle direct type references (returnType in CreateFunctionStmt)
    if ('names' in node && 'typemod' in node && Array.isArray(node.names) && node.names.length >= 2) {
      const firstNameNode = node.names[0];
      if (firstNameNode?.String?.sval === oldSchema) {
        firstNameNode.String.sval = newSchema;
      }
    }

    // Recurse into all object properties
    for (const value of Object.values(node)) {
      transformSchemaInSqlAst(value, oldSchema, newSchema);
    }
  }

  /**
   * Transform schema names in hydrated PL/pgSQL AST.
   * Walks through PLpgSQL_expr nodes and transforms embedded SQL ASTs.
   */
  function transformSchemaInPlpgsqlAst(
    node: any,
    oldSchema: string,
    newSchema: string
  ): void {
    if (node === null || node === undefined || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        transformSchemaInPlpgsqlAst(item, oldSchema, newSchema);
      }
      return;
    }

    // Handle PLpgSQL_expr nodes with hydrated queries
    if ('PLpgSQL_expr' in node) {
      const expr = node.PLpgSQL_expr;
      const query = expr.query;

      if (query && typeof query === 'object' && 'kind' in query) {
        // Handle sql-stmt kind (full SQL statements like SELECT, INSERT)
        if (query.kind === 'sql-stmt' && query.parseResult) {
          transformSchemaInSqlAst(query.parseResult, oldSchema, newSchema);
        }

        // Handle sql-expr kind (SQL expressions like function calls)
        if (query.kind === 'sql-expr' && query.expr) {
          transformSchemaInSqlAst(query.expr, oldSchema, newSchema);
        }

        // Handle assign kind (assignments like var := expr)
        if (query.kind === 'assign') {
          if (query.targetExpr) {
            transformSchemaInSqlAst(query.targetExpr, oldSchema, newSchema);
          }
          if (query.valueExpr) {
            transformSchemaInSqlAst(query.valueExpr, oldSchema, newSchema);
          }
        }
      }
    }

    // Handle PLpgSQL_type nodes (variable type declarations)
    if ('PLpgSQL_type' in node) {
      const plType = node.PLpgSQL_type;
      if (plType.typname && plType.typname.startsWith(oldSchema + '.')) {
        plType.typname = plType.typname.replace(oldSchema + '.', newSchema + '.');
      }
    }

    // Recurse into all object properties
    for (const value of Object.values(node)) {
      transformSchemaInPlpgsqlAst(value, oldSchema, newSchema);
    }
  }

  it('should transform schema names in a simple PL/pgSQL function', async () => {
    // Simple function with schema-qualified table reference in the body
    const sql = `
      CREATE FUNCTION old_schema.get_user_count()
      RETURNS int
      LANGUAGE plpgsql
      AS $$
      DECLARE
        user_count int;
      BEGIN
        SELECT count(*) INTO user_count FROM old_schema.users;
        RETURN user_count;
      END$$;
    `;

    // Step 1: Parse the SQL (includes PL/pgSQL parsing)
    const sqlParsed = parseSync(sql) as any;
    const plpgsqlParsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;

    // Step 2: Hydrate the PL/pgSQL AST (parses embedded SQL into AST nodes)
    const { ast: hydratedAst, stats } = hydratePlpgsqlAst(plpgsqlParsed);

    // Verify hydration worked
    expect(stats.parsedExpressions).toBeGreaterThan(0);
    expect(stats.failedExpressions).toBe(0);

    // Step 3: Transform schema names in both ASTs
    const oldSchema = 'old_schema';
    const newSchema = 'new_schema';

    // Transform outer SQL AST (CreateFunctionStmt)
    transformSchemaInSqlAst(sqlParsed, oldSchema, newSchema);

    // Transform PL/pgSQL AST (embedded SQL in function body)
    transformSchemaInPlpgsqlAst(hydratedAst, oldSchema, newSchema);

    // Step 4: Dehydrate the PL/pgSQL AST (converts AST back to strings)
    const dehydratedAst = dehydratePlpgsqlAst(hydratedAst);

    // Step 5: Deparse the PL/pgSQL body
    const newBody = deparseSync(dehydratedAst);

    // Step 6: Stitch the new body back into the SQL AST
    const createFunctionStmt = sqlParsed.stmts[0].stmt.CreateFunctionStmt;
    const asOption = createFunctionStmt.options.find(
      (opt: any) => opt.DefElem?.defname === 'as'
    );
    if (asOption?.DefElem?.arg?.List?.items?.[0]?.String) {
      asOption.DefElem.arg.List.items[0].String.sval = newBody;
    }

    // Step 7: Deparse the full SQL statement
    const output = Deparser.deparse(sqlParsed.stmts[0].stmt);

    // Verify transformations
    // Function name should be transformed
    expect(output).toContain('new_schema.get_user_count');
    expect(output).not.toContain('old_schema.get_user_count');

    // Table reference in SELECT should be transformed
    expect(output).toContain('new_schema.users');
    expect(output).not.toContain('old_schema.users');

    // Verify the output is valid SQL by re-parsing
    const reparsed = parseSync(output);
    expect(reparsed.stmts).toHaveLength(1);
    expect(reparsed.stmts[0].stmt).toHaveProperty('CreateFunctionStmt');
  });

  it('should transform schema names in trigger functions', async () => {
    const sql = `
      CREATE FUNCTION old_schema.audit_trigger()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        INSERT INTO old_schema.audit_log (table_name, action)
        VALUES (TG_TABLE_NAME, TG_OP);
        RETURN NEW;
      END$$;
    `;

    const sqlParsed = parseSync(sql) as any;
    const plpgsqlParsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
    const { ast: hydratedAst } = hydratePlpgsqlAst(plpgsqlParsed);

    const oldSchema = 'old_schema';
    const newSchema = 'audit_schema';

    transformSchemaInSqlAst(sqlParsed, oldSchema, newSchema);
    transformSchemaInPlpgsqlAst(hydratedAst, oldSchema, newSchema);

    const dehydratedAst = dehydratePlpgsqlAst(hydratedAst);
    const newBody = deparseSync(dehydratedAst);

    const createFunctionStmt = sqlParsed.stmts[0].stmt.CreateFunctionStmt;
    const asOption = createFunctionStmt.options.find(
      (opt: any) => opt.DefElem?.defname === 'as'
    );
    if (asOption?.DefElem?.arg?.List?.items?.[0]?.String) {
      asOption.DefElem.arg.List.items[0].String.sval = newBody;
    }

    const output = Deparser.deparse(sqlParsed.stmts[0].stmt);

    expect(output).toContain('audit_schema.audit_trigger');
    expect(output).toContain('audit_schema.audit_log');
    expect(output).not.toContain('old_schema');

    // Verify valid SQL
    const reparsed = parseSync(output);
    expect(reparsed.stmts).toHaveLength(1);
  });

  it('should transform schema names in RETURN QUERY functions', async () => {
    const sql = `
      CREATE FUNCTION app_public.get_active_users()
      RETURNS SETOF int
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY SELECT id FROM app_public.users WHERE is_active = true;
        RETURN;
      END$$;
    `;

    const sqlParsed = parseSync(sql) as any;
    const plpgsqlParsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
    const { ast: hydratedAst } = hydratePlpgsqlAst(plpgsqlParsed);

    transformSchemaInSqlAst(sqlParsed, 'app_public', 'myapp_public');
    transformSchemaInPlpgsqlAst(hydratedAst, 'app_public', 'myapp_public');

    const dehydratedAst = dehydratePlpgsqlAst(hydratedAst);
    const newBody = deparseSync(dehydratedAst);

    const createFunctionStmt = sqlParsed.stmts[0].stmt.CreateFunctionStmt;
    const asOption = createFunctionStmt.options.find(
      (opt: any) => opt.DefElem?.defname === 'as'
    );
    if (asOption?.DefElem?.arg?.List?.items?.[0]?.String) {
      asOption.DefElem.arg.List.items[0].String.sval = newBody;
    }

    const output = Deparser.deparse(sqlParsed.stmts[0].stmt);

    // All app_public references should be transformed
    expect(output).toContain('myapp_public.get_active_users');
    expect(output).toContain('myapp_public.users');
    // Use regex with word boundary to avoid matching 'app_public' inside 'myapp_public'
    expect(output).not.toMatch(/\bapp_public\./)

    // Verify valid SQL
    const reparsed = parseSync(output);
    expect(reparsed.stmts).toHaveLength(1);
  });

  it('should transform function calls inside PL/pgSQL expressions', async () => {
    const sql = `
      CREATE FUNCTION old_schema.calculate_total(p_amount numeric)
      RETURNS numeric
      LANGUAGE plpgsql
      AS $$
      DECLARE
        tax_rate numeric;
      BEGIN
        tax_rate := old_schema.get_tax_rate();
        RETURN p_amount * (1 + tax_rate);
      END$$;
    `;

    const sqlParsed = parseSync(sql) as any;
    const plpgsqlParsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
    const { ast: hydratedAst } = hydratePlpgsqlAst(plpgsqlParsed);

    transformSchemaInSqlAst(sqlParsed, 'old_schema', 'billing_schema');
    transformSchemaInPlpgsqlAst(hydratedAst, 'old_schema', 'billing_schema');

    const dehydratedAst = dehydratePlpgsqlAst(hydratedAst);
    const newBody = deparseSync(dehydratedAst);

    const createFunctionStmt = sqlParsed.stmts[0].stmt.CreateFunctionStmt;
    const asOption = createFunctionStmt.options.find(
      (opt: any) => opt.DefElem?.defname === 'as'
    );
    if (asOption?.DefElem?.arg?.List?.items?.[0]?.String) {
      asOption.DefElem.arg.List.items[0].String.sval = newBody;
    }

    const output = Deparser.deparse(sqlParsed.stmts[0].stmt);

    // Function name should be transformed
    expect(output).toContain('billing_schema.calculate_total');

    // Function call in assignment should be transformed
    expect(output).toContain('billing_schema.get_tax_rate');
    expect(output).not.toContain('old_schema');

    // Verify valid SQL
    const reparsed = parseSync(output);
    expect(reparsed.stmts).toHaveLength(1);
  });
});
