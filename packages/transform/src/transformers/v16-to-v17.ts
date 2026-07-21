import * as PG16 from '../16/types';
import * as PG17 from '../17/types';
import { TransformerContext } from './context';

/**
 * V16 to V17 AST Transformer
 * Transforms PostgreSQL v16 AST nodes to v17 format
 */
export class V16ToV17Transformer {

  transform(node: PG16.Node, context: TransformerContext = { parentNodeTypes: [] }): any {
    if (node == null) {
      return null;
    }

    if (typeof node === 'number' || node instanceof Number) {
      return node;
    }

    if (typeof node === 'string') {
      return node;
    }

    try {
      return this.visit(node, context);
    } catch (error) {
      const nodeType = Object.keys(node)[0];
      throw new Error(`Error transforming ${nodeType}: ${(error as Error).message}`);
    }
  }

  visit(node: PG16.Node, context: TransformerContext = { parentNodeTypes: [] }): any {
    const nodeType = this.getNodeType(node);

    // Handle empty objects
    if (!nodeType) {
      return {};
    }

    const nodeData = this.getNodeData(node);

    const methodName = nodeType as keyof this;
    if (typeof this[methodName] === 'function') {
      const childContext: TransformerContext = {
        ...context,
        parentNodeTypes: [...context.parentNodeTypes, nodeType]
      };

      const result = (this[methodName] as any)(nodeData, childContext);
      return result;
    }

    // If no specific method, return the node as-is
    return node;
  }


  getNodeType(node: PG16.Node): any {
    return Object.keys(node)[0];
  }

  getNodeData(node: PG16.Node): any {
    const keys = Object.keys(node);
    if (keys.length === 1 && typeof (node as any)[keys[0]] === 'object') {
      return (node as any)[keys[0]];
    }
    return node;
  }

  ParseResult(node: PG16.ParseResult, context: TransformerContext): PG17.ParseResult {

    if (node && typeof node === 'object' && 'version' in node && 'stmts' in node) {
      return {
        version: 170004, // PG17 version
        stmts: node.stmts.map((stmt: any) => {
          if (stmt && typeof stmt === 'object' && 'stmt' in stmt) {
            return {
              ...stmt,
              stmt: this.transform(stmt.stmt, context)
            };
          }
          return this.transform(stmt, context);
        })
      };
    }

    return node as PG17.ParseResult;
  }

  RawStmt(node: PG16.RawStmt, context: TransformerContext): { RawStmt: PG17.RawStmt } {
    const result: any = {};

    if (node.stmt !== undefined) {
      result.stmt = this.transform(node.stmt as any, context);
    }
    if (node.stmt_location !== undefined) {
      result.stmt_location = node.stmt_location;
    }
    if (node.stmt_len !== undefined) {
      result.stmt_len = node.stmt_len;
    }

    return { RawStmt: result };
  }

  SelectStmt(node: PG16.SelectStmt, context: TransformerContext): { SelectStmt: PG17.SelectStmt } {
    const result: any = {};

    if (node.distinctClause !== undefined) {
      result.distinctClause = Array.isArray(node.distinctClause)
        ? node.distinctClause.map(item => this.transform(item as any, context))
        : this.transform(node.distinctClause as any, context);
    }
    if (node.intoClause !== undefined) {
      result.intoClause = this.transform(node.intoClause as any, context);
    }
    if (node.targetList !== undefined) {
      result.targetList = Array.isArray(node.targetList)
        ? node.targetList.map(item => this.transform(item as any, context))
        : this.transform(node.targetList as any, context);
    }
    if (node.fromClause !== undefined) {
      result.fromClause = Array.isArray(node.fromClause)
        ? node.fromClause.map(item => this.transform(item as any, context))
        : this.transform(node.fromClause as any, context);
    }
    if (node.whereClause !== undefined) {
      result.whereClause = this.transform(node.whereClause as any, context);
    }
    if (node.groupClause !== undefined) {
      result.groupClause = Array.isArray(node.groupClause)
        ? node.groupClause.map(item => this.transform(item as any, context))
        : this.transform(node.groupClause as any, context);
    }
    if (node.groupDistinct !== undefined) {
      result.groupDistinct = node.groupDistinct;
    }
    if (node.havingClause !== undefined) {
      result.havingClause = this.transform(node.havingClause as any, context);
    }
    if (node.windowClause !== undefined) {
      result.windowClause = Array.isArray(node.windowClause)
        ? node.windowClause.map(item => this.transform(item as any, context))
        : this.transform(node.windowClause as any, context);
    }
    if (node.valuesLists !== undefined) {
      const valuesContext: TransformerContext = {
        ...context,
        inValuesClause: true
      };
      result.valuesLists = Array.isArray(node.valuesLists)
        ? node.valuesLists.map(item => Array.isArray(item)
            ? item.map(subItem => this.transform(subItem as any, valuesContext))
            : this.transform(item as any, valuesContext))
        : this.transform(node.valuesLists as any, valuesContext);
    }
    if (node.sortClause !== undefined) {
      result.sortClause = Array.isArray(node.sortClause)
        ? node.sortClause.map(item => this.transform(item as any, context))
        : this.transform(node.sortClause as any, context);
    }
    if (node.limitOffset !== undefined) {
      result.limitOffset = this.transform(node.limitOffset as any, context);
    }
    if (node.limitCount !== undefined) {
      result.limitCount = this.transform(node.limitCount as any, context);
    }
    if (node.limitOption !== undefined) {
      result.limitOption = node.limitOption;
    }
    if (node.lockingClause !== undefined) {
      result.lockingClause = Array.isArray(node.lockingClause)
        ? node.lockingClause.map(item => this.transform(item as any, context))
        : this.transform(node.lockingClause as any, context);
    }
    if (node.withClause !== undefined) {
      result.withClause = this.transform(node.withClause as any, context);
    }
    if (node.op !== undefined) {
      result.op = node.op;
    }
    if (node.all !== undefined) {
      result.all = node.all;
    }
    if (node.larg !== undefined) {
      result.larg = this.transform(node.larg as any, context);
    }
    if (node.rarg !== undefined) {
      result.rarg = this.transform(node.rarg as any, context);
    }

    return { SelectStmt: result };
  }

  A_Expr(node: PG16.A_Expr, context: TransformerContext): { A_Expr: PG17.A_Expr } {
    const result: any = {};

    if (node.kind !== undefined) {
      result.kind = node.kind;
    }
    if (node.name !== undefined) {
      result.name = Array.isArray(node.name)
        ? node.name.map(item => this.transform(item as any, context))
        : this.transform(node.name as any, context);
    }
    if (node.lexpr !== undefined) {
      result.lexpr = this.transform(node.lexpr as any, context);
    }
    if (node.rexpr !== undefined) {
      result.rexpr = this.transform(node.rexpr as any, context);
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { A_Expr: result };
  }

  InsertStmt(node: PG16.InsertStmt, context: TransformerContext): { InsertStmt: PG17.InsertStmt } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }
    if (node.cols !== undefined) {
      result.cols = Array.isArray(node.cols)
        ? node.cols.map(item => this.transform(item as any, context))
        : this.transform(node.cols as any, context);
    }
    if (node.selectStmt !== undefined) {
      result.selectStmt = this.transform(node.selectStmt as any, context);
    }
    if (node.onConflictClause !== undefined) {
      result.onConflictClause = this.transform(node.onConflictClause as any, context);
    }
    if (node.returningList !== undefined) {
      result.returningList = Array.isArray(node.returningList)
        ? node.returningList.map(item => this.transform(item as any, context))
        : this.transform(node.returningList as any, context);
    }
    if (node.withClause !== undefined) {
      result.withClause = this.transform(node.withClause as any, context);
    }
    if (node.override !== undefined) {
      result.override = node.override;
    }

    return { InsertStmt: result };
  }

  UpdateStmt(node: PG16.UpdateStmt, context: TransformerContext): { UpdateStmt: PG17.UpdateStmt } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }
    if (node.targetList !== undefined) {
      result.targetList = Array.isArray(node.targetList)
        ? node.targetList.map(item => this.transform(item as any, context))
        : this.transform(node.targetList as any, context);
    }
    if (node.whereClause !== undefined) {
      result.whereClause = this.transform(node.whereClause as any, context);
    }
    if (node.fromClause !== undefined) {
      result.fromClause = Array.isArray(node.fromClause)
        ? node.fromClause.map(item => this.transform(item as any, context))
        : this.transform(node.fromClause as any, context);
    }
    if (node.returningList !== undefined) {
      result.returningList = Array.isArray(node.returningList)
        ? node.returningList.map(item => this.transform(item as any, context))
        : this.transform(node.returningList as any, context);
    }
    if (node.withClause !== undefined) {
      result.withClause = this.transform(node.withClause as any, context);
    }

    return { UpdateStmt: result };
  }

  DeleteStmt(node: PG16.DeleteStmt, context: TransformerContext): { DeleteStmt: PG17.DeleteStmt } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }
    if (node.usingClause !== undefined) {
      result.usingClause = Array.isArray(node.usingClause)
        ? node.usingClause.map(item => this.transform(item as any, context))
        : this.transform(node.usingClause as any, context);
    }
    if (node.whereClause !== undefined) {
      result.whereClause = this.transform(node.whereClause as any, context);
    }
    if (node.returningList !== undefined) {
      result.returningList = Array.isArray(node.returningList)
        ? node.returningList.map(item => this.transform(item as any, context))
        : this.transform(node.returningList as any, context);
    }
    if (node.withClause !== undefined) {
      result.withClause = this.transform(node.withClause as any, context);
    }

    return { DeleteStmt: result };
  }

  WithClause(node: PG16.WithClause, context: TransformerContext): { WithClause: PG17.WithClause } {
    const result: any = {};

    if (node.ctes !== undefined) {
      const cteContext = { ...context, inCTE: true };
      result.ctes = Array.isArray(node.ctes)
        ? node.ctes.map(item => this.transform(item as any, cteContext))
        : this.transform(node.ctes as any, cteContext);
    }
    if (node.recursive !== undefined) {
      result.recursive = node.recursive;
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { WithClause: result };
  }

  ResTarget(node: PG16.ResTarget, context: TransformerContext): { ResTarget: PG17.ResTarget } {
    const result: any = {};

    if (node.name !== undefined) {
      result.name = node.name;
    }
    if (node.indirection !== undefined) {
      result.indirection = Array.isArray(node.indirection)
        ? node.indirection.map(item => this.transform(item as any, context))
        : this.transform(node.indirection as any, context);
    }
    if (node.val !== undefined) {
      result.val = this.transform(node.val as any, context);
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { ResTarget: result };
  }

  BoolExpr(node: PG16.BoolExpr, context: TransformerContext): { BoolExpr: PG17.BoolExpr } {
    const result: any = {};

    if (node.boolop !== undefined) {
      result.boolop = node.boolop;
    }
    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map(item => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { BoolExpr: result };
  }

  FuncCall(node: PG16.FuncCall, context: TransformerContext): { FuncCall: PG17.FuncCall } {
    const result: any = {};

    if (node.funcname !== undefined) {
      result.funcname = Array.isArray(node.funcname)
        ? node.funcname.map(item => this.transform(item as any, context))
        : this.transform(node.funcname as any, context);
    }
    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map(item => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }
    if (node.agg_order !== undefined) {
      result.agg_order = Array.isArray(node.agg_order)
        ? node.agg_order.map(item => this.transform(item as any, context))
        : this.transform(node.agg_order as any, context);
    }
    if (node.agg_filter !== undefined) {
      result.agg_filter = this.transform(node.agg_filter as any, context);
    }
    if (node.agg_within_group !== undefined) {
      result.agg_within_group = node.agg_within_group;
    }
    if (node.agg_star !== undefined) {
      result.agg_star = node.agg_star;
    }
    if (node.agg_distinct !== undefined) {
      result.agg_distinct = node.agg_distinct;
    }
    if (node.func_variadic !== undefined) {
      result.func_variadic = node.func_variadic;
    }
    if (node.over !== undefined) {
      result.over = this.transform(node.over as any, context);
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    const funcformatValue = this.getFuncformatValue(node, result.funcname, context);
    result.funcformat = funcformatValue;

    return { FuncCall: result };
  }

  FuncExpr(node: PG16.FuncExpr, context: TransformerContext): { FuncExpr: PG17.FuncExpr } {
    return { FuncExpr: node as PG17.FuncExpr };
  }

  A_Const(node: PG16.A_Const, context: TransformerContext): { A_Const: PG17.A_Const } {
    return { A_Const: node };
  }

  ColumnRef(node: PG16.ColumnRef, context: TransformerContext): { ColumnRef: PG17.ColumnRef } {
    return { ColumnRef: node as PG17.ColumnRef };
  }


  private isInCreateDomainContext(context: TransformerContext): boolean {
    return context.parentNodeTypes.includes('CreateDomainStmt');
  }

  private isInTypeCastContext(context: TransformerContext): boolean {
    return context.parentNodeTypes.includes('TypeCast');
  }

  private isInCreateTableContext(context: TransformerContext): boolean {
    return context.parentNodeTypes.includes('ColumnDef');
  }

  private isInValuesContext(context: TransformerContext): boolean {
    return context.inValuesClause === true;
  }

  private isInSimpleSelectTypeCastContext(context: TransformerContext): boolean {
    return context.parentNodeTypes.includes('TypeCast') && 
           context.parentNodeTypes.includes('ResTarget') &&
           !this.isInValuesContext(context);
  }

  private shouldAddPgCatalogPrefix(context: TransformerContext): boolean {
    const hasSelectStmt = context.parentNodeTypes.includes('SelectStmt');
    const hasWithClause = context.parentNodeTypes.includes('WithClause');
    const hasCommonTableExpr = context.parentNodeTypes.includes('CommonTableExpr');
    
    return hasSelectStmt && !hasWithClause && !hasCommonTableExpr;
  }

  TypeName(node: PG16.TypeName, context: TransformerContext): { TypeName: PG17.TypeName } {
    const result: any = {};

    if (node.names !== undefined) {
      let names = Array.isArray(node.names)
        ? node.names.map(item => this.transform(item as any, context))
        : this.transform(node.names as any, context);
      
      // Add pg_catalog prefix for JSON types in CREATE TABLE contexts
      if (Array.isArray(names) && names.length === 1) {
        const firstElement = names[0];
        if (firstElement && typeof firstElement === 'object' && 'String' in firstElement) {
          const typeNameStr = firstElement.String.str || firstElement.String.sval;
          if (typeNameStr === 'json') {
            const hasCreateStmt = context.parentNodeTypes.includes('CreateStmt');
            const hasCompositeTypeStmt = context.parentNodeTypes.includes('CompositeTypeStmt');
            const hasRangeFunction = context.parentNodeTypes.includes('RangeFunction');
            const hasCreateDomainStmt = context.parentNodeTypes.includes('CreateDomainStmt');
            const hasColumnDef = context.parentNodeTypes.includes('ColumnDef');
            if ((hasCreateStmt || hasCompositeTypeStmt || hasRangeFunction) && hasColumnDef) {
              const pgCatalogElement = {
                String: {
                  sval: 'pg_catalog'
                }
              };
              names = [pgCatalogElement, firstElement];
            } else if (hasCreateDomainStmt) {
              const pgCatalogElement = {
                String: {
                  sval: 'pg_catalog'
                }
              };
              names = [pgCatalogElement, firstElement];
            }
          }
        }
      }
      
      result.names = names;
    }

    if (node.typeOid !== undefined) {
      result.typeOid = node.typeOid;
    }

    if (node.setof !== undefined) {
      result.setof = node.setof;
    }

    if (node.pct_type !== undefined) {
      result.pct_type = node.pct_type;
    }

    if (node.typmods !== undefined) {
      result.typmods = Array.isArray(node.typmods)
        ? node.typmods.map(item => this.transform(item as any, context))
        : this.transform(node.typmods as any, context);
    }

    if (node.typemod !== undefined) {
      result.typemod = node.typemod;
    }

    if (node.arrayBounds !== undefined) {
      result.arrayBounds = Array.isArray(node.arrayBounds)
        ? node.arrayBounds.map(item => this.transform(item as any, context))
        : this.transform(node.arrayBounds as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { TypeName: result };
  }

  Alias(node: PG16.Alias, context: TransformerContext): { Alias: PG17.Alias } {
    return { Alias: node as PG17.Alias };
  }

  RangeVar(node: PG16.RangeVar, context: TransformerContext): { RangeVar: PG17.RangeVar } {
    const result: any = {};

    if (node.catalogname !== undefined) {
      result.catalogname = node.catalogname;
    }
    if (node.schemaname !== undefined) {
      result.schemaname = node.schemaname;
    }
    if (node.relname !== undefined) {
      result.relname = node.relname;
    }
    if (node.inh !== undefined) {
      result.inh = node.inh;
    }
    if (node.relpersistence !== undefined) {
      result.relpersistence = node.relpersistence;
    }
    if (node.alias !== undefined) {
      result.alias = this.transform(node.alias as any, context);
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { RangeVar: result };
  }

  A_ArrayExpr(node: PG16.A_ArrayExpr, context: TransformerContext): { A_ArrayExpr: PG17.A_ArrayExpr } {
    return { A_ArrayExpr: node as PG17.A_ArrayExpr };
  }

  A_Indices(node: PG16.A_Indices, context: TransformerContext): { A_Indices: PG17.A_Indices } {
    return { A_Indices: node as PG17.A_Indices };
  }

  A_Indirection(node: PG16.A_Indirection, context: TransformerContext): { A_Indirection: PG17.A_Indirection } {
    return { A_Indirection: node as PG17.A_Indirection };
  }

  A_Star(node: PG16.A_Star, context: TransformerContext): { A_Star: PG17.A_Star } {
    return { A_Star: node as PG17.A_Star };
  }

  CaseExpr(node: PG16.CaseExpr, context: TransformerContext): { CaseExpr: PG17.CaseExpr } {
    return { CaseExpr: node as PG17.CaseExpr };
  }

  CoalesceExpr(node: PG16.CoalesceExpr, context: TransformerContext): { CoalesceExpr: PG17.CoalesceExpr } {
    return { CoalesceExpr: node as PG17.CoalesceExpr };
  }

  TypeCast(node: PG16.TypeCast, context: TransformerContext): { TypeCast: PG17.TypeCast } {
    const result: any = {};
    
    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }
    if (node.typeName !== undefined) {
      let typeName = this.transform(node.typeName as any, context);
      
      // Add pg_catalog prefix for JSON types in simple SELECT contexts, but NOT in WITH clauses
      if (typeName && typeName.names && Array.isArray(typeName.names) && typeName.names.length === 1) {
        const firstElement = typeName.names[0];
        if (firstElement && typeof firstElement === 'object' && 'String' in firstElement) {
          const typeNameStr = firstElement.String.str || firstElement.String.sval;
          if (typeNameStr === 'json') {
            const hasSelectStmt = context.parentNodeTypes.includes('SelectStmt');
            const hasResTarget = context.parentNodeTypes.includes('ResTarget');
            const hasList = context.parentNodeTypes.includes('List');
            const hasA_Expr = context.parentNodeTypes.includes('A_Expr');
            const hasWithClause = context.parentNodeTypes.includes('WithClause');
            const hasCommonTableExpr = context.parentNodeTypes.includes('CommonTableExpr');
            
            if (((hasSelectStmt && hasResTarget) || (hasSelectStmt && hasList) || hasA_Expr) && !hasWithClause && !hasCommonTableExpr) {
              const pgCatalogElement = {
                String: {
                  sval: 'pg_catalog'
                }
              };
              typeName.names = [pgCatalogElement, firstElement];
            }
          }
        }
      }
      
      result.typeName = typeName;
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }
    
    return { TypeCast: result };
  }

  CollateClause(node: PG16.CollateClause, context: TransformerContext): { CollateClause: PG17.CollateClause } {
    return { CollateClause: node as PG17.CollateClause };
  }

  BooleanTest(node: PG16.BooleanTest, context: TransformerContext): { BooleanTest: PG17.BooleanTest } {
    return { BooleanTest: node as PG17.BooleanTest };
  }

  NullTest(node: PG16.NullTest, context: TransformerContext): { NullTest: PG17.NullTest } {
    return { NullTest: node as PG17.NullTest };
  }

  String(node: PG16.String, context: TransformerContext): { String: PG17.String } {
    return { String: node as PG17.String };
  }

  Integer(node: PG16.Integer, context: TransformerContext): { Integer: PG17.Integer } {
    return { Integer: node as PG17.Integer };
  }

  Float(node: PG16.Float, context: TransformerContext): { Float: PG17.Float } {
    return { Float: node as PG17.Float };
  }

  Boolean(node: PG16.Boolean, context: TransformerContext): { Boolean: PG17.Boolean } {
    return { Boolean: node as PG17.Boolean };
  }

  BitString(node: PG16.BitString, context: TransformerContext): { BitString: PG17.BitString } {
    return { BitString: node as PG17.BitString };
  }

  // NOTE: there is no Null type in PG17
  Null(node: any, context: TransformerContext): any {
    return { Null: node };
  }

  List(node: PG16.List, context: TransformerContext): { List: PG17.List } {
    const result: any = {};

    if (node.items !== undefined) {
      result.items = Array.isArray(node.items)
        ? node.items.map(item => this.transform(item as any, context))
        : this.transform(node.items as any, context);
    }

    return { List: result };
  }

  CreateStmt(node: PG16.CreateStmt, context: TransformerContext): { CreateStmt: PG17.CreateStmt } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }
    if (node.tableElts !== undefined) {
      result.tableElts = Array.isArray(node.tableElts)
        ? node.tableElts.map(item => this.transform(item as any, context))
        : this.transform(node.tableElts as any, context);
    }
    if (node.inhRelations !== undefined) {
      result.inhRelations = Array.isArray(node.inhRelations)
        ? node.inhRelations.map(item => this.transform(item as any, context))
        : this.transform(node.inhRelations as any, context);
    }
    if (node.partbound !== undefined) {
      result.partbound = this.transform(node.partbound as any, context);
    }
    if (node.partspec !== undefined) {
      result.partspec = this.transform(node.partspec as any, context);
    }
    if (node.ofTypename !== undefined) {
      result.ofTypename = this.transform(node.ofTypename as any, context);
    }
    if (node.constraints !== undefined) {
      result.constraints = Array.isArray(node.constraints)
        ? node.constraints.map(item => this.transform(item as any, context))
        : this.transform(node.constraints as any, context);
    }
    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map(item => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }
    if (node.oncommit !== undefined) {
      result.oncommit = node.oncommit;
    }
    if (node.tablespacename !== undefined) {
      result.tablespacename = node.tablespacename;
    }
    if (node.accessMethod !== undefined) {
      result.accessMethod = node.accessMethod;
    }
    if (node.if_not_exists !== undefined) {
      result.if_not_exists = node.if_not_exists;
    }

    return { CreateStmt: result };
  }

  ColumnDef(node: PG16.ColumnDef, context: TransformerContext): { ColumnDef: PG17.ColumnDef } {
    const result: any = {};

    if (node.colname !== undefined) {
      result.colname = node.colname;
    }
    if (node.typeName !== undefined) {
      const transformedTypeName = this.TypeName(node.typeName as any, context);
      result.typeName = transformedTypeName.TypeName;
    }
    if (node.inhcount !== undefined) {
      result.inhcount = node.inhcount;
    }
    if (node.is_local !== undefined) {
      result.is_local = node.is_local;
    }
    if (node.is_not_null !== undefined) {
      result.is_not_null = node.is_not_null;
    }
    if (node.is_from_type !== undefined) {
      result.is_from_type = node.is_from_type;
    }
    if (node.storage !== undefined) {
      result.storage = node.storage;
    }
    if (node.raw_default !== undefined) {
      result.raw_default = this.transform(node.raw_default as any, context);
    }
    if (node.cooked_default !== undefined) {
      result.cooked_default = this.transform(node.cooked_default as any, context);
    }
    if (node.identity !== undefined) {
      result.identity = node.identity;
    }
    if (node.identitySequence !== undefined) {
      result.identitySequence = this.transform(node.identitySequence as any, context);
    }
    if (node.generated !== undefined) {
      result.generated = node.generated;
    }
    if (node.collClause !== undefined) {
      result.collClause = this.transform(node.collClause as any, context);
    }
    if (node.collOid !== undefined) {
      result.collOid = node.collOid;
    }
    if (node.constraints !== undefined) {
      result.constraints = Array.isArray(node.constraints)
        ? node.constraints.map(item => this.transform(item as any, context))
        : this.transform(node.constraints as any, context);
    }
    if (node.fdwoptions !== undefined) {
      result.fdwoptions = Array.isArray(node.fdwoptions)
        ? node.fdwoptions.map(item => this.transform(item as any, context))
        : this.transform(node.fdwoptions as any, context);
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { ColumnDef: result };
  }

  Constraint(node: PG16.Constraint, context: TransformerContext): { Constraint: PG17.Constraint } {
    return { Constraint: node as PG17.Constraint };
  }

  SubLink(node: PG16.SubLink, context: TransformerContext): { SubLink: PG17.SubLink } {
    return { SubLink: node as PG17.SubLink };
  }

  CaseWhen(node: PG16.CaseWhen, context: TransformerContext): { CaseWhen: PG17.CaseWhen } {
    return { CaseWhen: node as PG17.CaseWhen };
  }

  WindowDef(node: PG16.WindowDef, context: TransformerContext): { WindowDef: PG17.WindowDef } {
    return { WindowDef: node as PG17.WindowDef };
  }

  SortBy(node: PG16.SortBy, context: TransformerContext): { SortBy: PG17.SortBy } {
    return { SortBy: node as PG17.SortBy };
  }

  GroupingSet(node: PG16.GroupingSet, context: TransformerContext): { GroupingSet: PG17.GroupingSet } {
    return { GroupingSet: node as PG17.GroupingSet };
  }

  CommonTableExpr(node: PG16.CommonTableExpr, context: TransformerContext): { CommonTableExpr: PG17.CommonTableExpr } {
    const result: any = {};

    if (node.ctename !== undefined) {
      result.ctename = node.ctename;
    }
    if (node.aliascolnames !== undefined) {
      result.aliascolnames = Array.isArray(node.aliascolnames)
        ? node.aliascolnames.map(item => this.transform(item as any, context))
        : this.transform(node.aliascolnames as any, context);
    }
    if (node.ctematerialized !== undefined) {
      result.ctematerialized = node.ctematerialized;
    }
    if (node.ctequery !== undefined) {
      result.ctequery = this.transform(node.ctequery as any, context);
    }
    if (node.search_clause !== undefined) {
      result.search_clause = this.transform(node.search_clause as any, context);
    }
    if (node.cycle_clause !== undefined) {
      result.cycle_clause = this.transform(node.cycle_clause as any, context);
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { CommonTableExpr: result };
  }

  ParamRef(node: PG16.ParamRef, context: TransformerContext): { ParamRef: PG17.ParamRef } {
    return { ParamRef: node as PG17.ParamRef };
  }

  LockingClause(node: any, context: TransformerContext): { LockingClause: any } {
    return { LockingClause: node };
  }

  MinMaxExpr(node: PG16.MinMaxExpr, context: TransformerContext): { MinMaxExpr: PG17.MinMaxExpr } {
    return { MinMaxExpr: node as PG17.MinMaxExpr };
  }

  RowExpr(node: PG16.RowExpr, context: TransformerContext): { RowExpr: PG17.RowExpr } {
    return { RowExpr: node as PG17.RowExpr };
  }

  OpExpr(node: PG16.OpExpr, context: TransformerContext): { OpExpr: PG17.OpExpr } {
    return { OpExpr: node as PG17.OpExpr };
  }

  DistinctExpr(node: PG16.DistinctExpr, context: TransformerContext): { DistinctExpr: PG17.DistinctExpr } {
    return { DistinctExpr: node as PG17.DistinctExpr };
  }

  NullIfExpr(node: PG16.NullIfExpr, context: TransformerContext): { NullIfExpr: PG17.NullIfExpr } {
    return { NullIfExpr: node as PG17.NullIfExpr };
  }

  ScalarArrayOpExpr(node: PG16.ScalarArrayOpExpr, context: TransformerContext): { ScalarArrayOpExpr: PG17.ScalarArrayOpExpr } {
    return { ScalarArrayOpExpr: node as PG17.ScalarArrayOpExpr };
  }

  Aggref(node: PG16.Aggref, context: TransformerContext): { Aggref: PG17.Aggref } {
    return { Aggref: node as PG17.Aggref };
  }

  WindowFunc(node: PG16.WindowFunc, context: TransformerContext): { WindowFunc: PG17.WindowFunc } {
    return { WindowFunc: node as PG17.WindowFunc };
  }

  FieldSelect(node: PG16.FieldSelect, context: TransformerContext): { FieldSelect: PG17.FieldSelect } {
    return { FieldSelect: node as PG17.FieldSelect };
  }

  RelabelType(node: PG16.RelabelType, context: TransformerContext): { RelabelType: PG17.RelabelType } {
    return { RelabelType: node as PG17.RelabelType };
  }

  CoerceViaIO(node: PG16.CoerceViaIO, context: TransformerContext): { CoerceViaIO: PG17.CoerceViaIO } {
    return { CoerceViaIO: node as PG17.CoerceViaIO };
  }

  ArrayCoerceExpr(node: PG16.ArrayCoerceExpr, context: TransformerContext): { ArrayCoerceExpr: PG17.ArrayCoerceExpr } {
    return { ArrayCoerceExpr: node as PG17.ArrayCoerceExpr };
  }

  ConvertRowtypeExpr(node: PG16.ConvertRowtypeExpr, context: TransformerContext): { ConvertRowtypeExpr: PG17.ConvertRowtypeExpr } {
    return { ConvertRowtypeExpr: node as PG17.ConvertRowtypeExpr };
  }

  NamedArgExpr(node: PG16.NamedArgExpr, context: TransformerContext): { NamedArgExpr: PG17.NamedArgExpr } {
    return { NamedArgExpr: node as PG17.NamedArgExpr };
  }

  ViewStmt(node: PG16.ViewStmt, context: TransformerContext): { ViewStmt: PG17.ViewStmt } {
    return { ViewStmt: node as PG17.ViewStmt };
  }

  IndexStmt(node: PG16.IndexStmt, context: TransformerContext): { IndexStmt: PG17.IndexStmt } {
    return { IndexStmt: node as PG17.IndexStmt };
  }

  IndexElem(node: PG16.IndexElem, context: TransformerContext): { IndexElem: PG17.IndexElem } {
    return { IndexElem: node as PG17.IndexElem };
  }

  PartitionElem(node: PG16.PartitionElem, context: TransformerContext): { PartitionElem: PG17.PartitionElem } {
    return { PartitionElem: node as PG17.PartitionElem };
  }

  PartitionCmd(node: PG16.PartitionCmd, context: TransformerContext): { PartitionCmd: PG17.PartitionCmd } {
    return { PartitionCmd: node as PG17.PartitionCmd };
  }

  JoinExpr(node: PG16.JoinExpr, context: TransformerContext): { JoinExpr: PG17.JoinExpr } {
    return { JoinExpr: node as PG17.JoinExpr };
  }

  FromExpr(node: PG16.FromExpr, context: TransformerContext): { FromExpr: PG17.FromExpr } {
    return { FromExpr: node as PG17.FromExpr };
  }

  TransactionStmt(node: PG16.TransactionStmt, context: TransformerContext): { TransactionStmt: PG17.TransactionStmt } {
    return { TransactionStmt: node as PG17.TransactionStmt };
  }

  VariableSetStmt(node: PG16.VariableSetStmt, context: TransformerContext): { VariableSetStmt: PG17.VariableSetStmt } {
    return { VariableSetStmt: node as PG17.VariableSetStmt };
  }

  VariableShowStmt(node: PG16.VariableShowStmt, context: TransformerContext): { VariableShowStmt: PG17.VariableShowStmt } {
    return { VariableShowStmt: node as PG17.VariableShowStmt };
  }

  CreateSchemaStmt(node: PG16.CreateSchemaStmt, context: TransformerContext): { CreateSchemaStmt: PG17.CreateSchemaStmt } {
    return { CreateSchemaStmt: node as PG17.CreateSchemaStmt };
  }

  RoleSpec(node: PG16.RoleSpec, context: TransformerContext): { RoleSpec: PG17.RoleSpec } {
    return { RoleSpec: node as PG17.RoleSpec };
  }

  DropStmt(node: PG16.DropStmt, context: TransformerContext): { DropStmt: PG17.DropStmt } {
    return { DropStmt: node as PG17.DropStmt };
  }

  TruncateStmt(node: PG16.TruncateStmt, context: TransformerContext): { TruncateStmt: PG17.TruncateStmt } {
    return { TruncateStmt: node as PG17.TruncateStmt };
  }

  ReturnStmt(node: PG16.ReturnStmt, context: TransformerContext): { ReturnStmt: PG17.ReturnStmt } {
    return { ReturnStmt: node as PG17.ReturnStmt };
  }

  PLAssignStmt(node: PG16.PLAssignStmt, context: TransformerContext): { PLAssignStmt: PG17.PLAssignStmt } {
    return { PLAssignStmt: node as PG17.PLAssignStmt };
  }

  CopyStmt(node: PG16.CopyStmt, context: TransformerContext): { CopyStmt: PG17.CopyStmt } {
    return { CopyStmt: node as PG17.CopyStmt };
  }

  AlterTableStmt(node: PG16.AlterTableStmt, context: TransformerContext): { AlterTableStmt: PG17.AlterTableStmt } {
    return { AlterTableStmt: node as PG17.AlterTableStmt };
  }

  AlterTableCmd(node: PG16.AlterTableCmd, context: TransformerContext): { AlterTableCmd: PG17.AlterTableCmd } {
    return { AlterTableCmd: node as PG17.AlterTableCmd };
  }

  CreateFunctionStmt(node: PG16.CreateFunctionStmt, context: TransformerContext): { CreateFunctionStmt: PG17.CreateFunctionStmt } {
    return { CreateFunctionStmt: node as PG17.CreateFunctionStmt };
  }

  FunctionParameter(node: PG16.FunctionParameter, context: TransformerContext): { FunctionParameter: PG17.FunctionParameter } {
    return { FunctionParameter: node as PG17.FunctionParameter };
  }

  CreateEnumStmt(node: PG16.CreateEnumStmt, context: TransformerContext): { CreateEnumStmt: PG17.CreateEnumStmt } {
    return { CreateEnumStmt: node as PG17.CreateEnumStmt };
  }

  CreateDomainStmt(node: PG16.CreateDomainStmt, context: TransformerContext): { CreateDomainStmt: PG17.CreateDomainStmt } {
    const result: any = {};

    if (node.domainname !== undefined) {
      result.domainname = Array.isArray(node.domainname)
        ? node.domainname.map(item => this.transform(item as any, context))
        : this.transform(node.domainname as any, context);
    }
    if (node.typeName !== undefined) {
      const transformedTypeName = this.TypeName(node.typeName as any, context);
      result.typeName = transformedTypeName.TypeName;
    }
    if (node.collClause !== undefined) {
      result.collClause = this.transform(node.collClause as any, context);
    }
    if (node.constraints !== undefined) {
      result.constraints = Array.isArray(node.constraints)
        ? node.constraints.map(item => this.transform(item as any, context))
        : this.transform(node.constraints as any, context);
    }

    return { CreateDomainStmt: result };
  }

  CreateRoleStmt(node: PG16.CreateRoleStmt, context: TransformerContext): { CreateRoleStmt: PG17.CreateRoleStmt } {
    return { CreateRoleStmt: node as PG17.CreateRoleStmt };
  }

  DefElem(node: PG16.DefElem, context: TransformerContext): { DefElem: PG17.DefElem } {
    return { DefElem: node as PG17.DefElem };
  }

  CreateTableSpaceStmt(node: PG16.CreateTableSpaceStmt, context: TransformerContext): { CreateTableSpaceStmt: PG17.CreateTableSpaceStmt } {
    return { CreateTableSpaceStmt: node as PG17.CreateTableSpaceStmt };
  }

  DropTableSpaceStmt(node: PG16.DropTableSpaceStmt, context: TransformerContext): { DropTableSpaceStmt: PG17.DropTableSpaceStmt } {
    return { DropTableSpaceStmt: node as PG17.DropTableSpaceStmt };
  }

  AlterTableSpaceOptionsStmt(node: PG16.AlterTableSpaceOptionsStmt, context: TransformerContext): { AlterTableSpaceOptionsStmt: PG17.AlterTableSpaceOptionsStmt } {
    return { AlterTableSpaceOptionsStmt: node as PG17.AlterTableSpaceOptionsStmt };
  }

  CreateExtensionStmt(node: PG16.CreateExtensionStmt, context: TransformerContext): { CreateExtensionStmt: PG17.CreateExtensionStmt } {
    return { CreateExtensionStmt: node as PG17.CreateExtensionStmt };
  }

  AlterExtensionStmt(node: PG16.AlterExtensionStmt, context: TransformerContext): { AlterExtensionStmt: PG17.AlterExtensionStmt } {
    return { AlterExtensionStmt: node as PG17.AlterExtensionStmt };
  }

  CreateFdwStmt(node: PG16.CreateFdwStmt, context: TransformerContext): { CreateFdwStmt: PG17.CreateFdwStmt } {
    return { CreateFdwStmt: node as PG17.CreateFdwStmt };
  }

  SetOperationStmt(node: PG16.SetOperationStmt, context: TransformerContext): { SetOperationStmt: PG17.SetOperationStmt } {
    return { SetOperationStmt: node as PG17.SetOperationStmt };
  }

  ReplicaIdentityStmt(node: PG16.ReplicaIdentityStmt, context: TransformerContext): { ReplicaIdentityStmt: PG17.ReplicaIdentityStmt } {
    return { ReplicaIdentityStmt: node as PG17.ReplicaIdentityStmt };
  }

  AlterCollationStmt(node: PG16.AlterCollationStmt, context: TransformerContext): { AlterCollationStmt: PG17.AlterCollationStmt } {
    return { AlterCollationStmt: node as PG17.AlterCollationStmt };
  }

  AlterDomainStmt(node: PG16.AlterDomainStmt, context: TransformerContext): { AlterDomainStmt: PG17.AlterDomainStmt } {
    return { AlterDomainStmt: node as PG17.AlterDomainStmt };
  }

  PrepareStmt(node: PG16.PrepareStmt, context: TransformerContext): { PrepareStmt: PG17.PrepareStmt } {
    return { PrepareStmt: node as PG17.PrepareStmt };
  }

  ExecuteStmt(node: PG16.ExecuteStmt, context: TransformerContext): { ExecuteStmt: PG17.ExecuteStmt } {
    return { ExecuteStmt: node as PG17.ExecuteStmt };
  }

  DeallocateStmt(node: PG16.DeallocateStmt, context: TransformerContext): { DeallocateStmt: PG17.DeallocateStmt } {
    const result: any = {};

    if (node.name !== undefined) {
      result.name = node.name;
    }

    if (node.name === undefined || node.name === null) {
      result.isall = true;
    }

    return { DeallocateStmt: result };
  }

  NotifyStmt(node: PG16.NotifyStmt, context: TransformerContext): { NotifyStmt: PG17.NotifyStmt } {
    return { NotifyStmt: node as PG17.NotifyStmt };
  }

  ListenStmt(node: PG16.ListenStmt, context: TransformerContext): { ListenStmt: PG17.ListenStmt } {
    return { ListenStmt: node as PG17.ListenStmt };
  }

  UnlistenStmt(node: PG16.UnlistenStmt, context: TransformerContext): { UnlistenStmt: PG17.UnlistenStmt } {
    return { UnlistenStmt: node as PG17.UnlistenStmt };
  }

  CheckPointStmt(node: PG16.CheckPointStmt, context: TransformerContext): { CheckPointStmt: PG17.CheckPointStmt } {
    return { CheckPointStmt: node as PG17.CheckPointStmt };
  }

  LoadStmt(node: PG16.LoadStmt, context: TransformerContext): { LoadStmt: PG17.LoadStmt } {
    return { LoadStmt: node as PG17.LoadStmt };
  }

  DiscardStmt(node: PG16.DiscardStmt, context: TransformerContext): { DiscardStmt: PG17.DiscardStmt } {
    return { DiscardStmt: node as PG17.DiscardStmt };
  }

  CommentStmt(node: PG16.CommentStmt, context: TransformerContext): { CommentStmt: PG17.CommentStmt } {
    return { CommentStmt: node as PG17.CommentStmt };
  }

  LockStmt(node: PG16.LockStmt, context: TransformerContext): { LockStmt: PG17.LockStmt } {
    return { LockStmt: node as PG17.LockStmt };
  }

  CreatePolicyStmt(node: PG16.CreatePolicyStmt, context: TransformerContext): { CreatePolicyStmt: PG17.CreatePolicyStmt } {
    return { CreatePolicyStmt: node as PG17.CreatePolicyStmt };
  }

  AlterPolicyStmt(node: PG16.AlterPolicyStmt, context: TransformerContext): { AlterPolicyStmt: PG17.AlterPolicyStmt } {
    return { AlterPolicyStmt: node as PG17.AlterPolicyStmt };
  }

  CreateUserMappingStmt(node: PG16.CreateUserMappingStmt, context: TransformerContext): { CreateUserMappingStmt: PG17.CreateUserMappingStmt } {
    return { CreateUserMappingStmt: node as PG17.CreateUserMappingStmt };
  }

  CreateStatsStmt(node: PG16.CreateStatsStmt, context: TransformerContext): { CreateStatsStmt: PG17.CreateStatsStmt } {
    return { CreateStatsStmt: node as PG17.CreateStatsStmt };
  }

  StatsElem(node: PG16.StatsElem, context: TransformerContext): { StatsElem: PG17.StatsElem } {
    return { StatsElem: node as PG17.StatsElem };
  }

  CreatePublicationStmt(node: PG16.CreatePublicationStmt, context: TransformerContext): { CreatePublicationStmt: PG17.CreatePublicationStmt } {
    return { CreatePublicationStmt: node as PG17.CreatePublicationStmt };
  }

  CreateSubscriptionStmt(node: PG16.CreateSubscriptionStmt, context: TransformerContext): { CreateSubscriptionStmt: PG17.CreateSubscriptionStmt } {
    return { CreateSubscriptionStmt: node as PG17.CreateSubscriptionStmt };
  }

  AlterPublicationStmt(node: PG16.AlterPublicationStmt, context: TransformerContext): { AlterPublicationStmt: PG17.AlterPublicationStmt } {
    return { AlterPublicationStmt: node as PG17.AlterPublicationStmt };
  }

  AlterSubscriptionStmt(node: PG16.AlterSubscriptionStmt, context: TransformerContext): { AlterSubscriptionStmt: PG17.AlterSubscriptionStmt } {
    return { AlterSubscriptionStmt: node as PG17.AlterSubscriptionStmt };
  }

  DropSubscriptionStmt(node: PG16.DropSubscriptionStmt, context: TransformerContext): { DropSubscriptionStmt: PG17.DropSubscriptionStmt } {
    return { DropSubscriptionStmt: node as PG17.DropSubscriptionStmt };
  }

  DoStmt(node: PG16.DoStmt, context: TransformerContext): { DoStmt: PG17.DoStmt } {
    return { DoStmt: node as PG17.DoStmt };
  }

  InlineCodeBlock(node: PG16.InlineCodeBlock, context: TransformerContext): { InlineCodeBlock: PG17.InlineCodeBlock } {
    return { InlineCodeBlock: node as PG17.InlineCodeBlock };
  }

  CallContext(node: PG16.CallContext, context: TransformerContext): { CallContext: PG17.CallContext } {
    return { CallContext: node as PG17.CallContext };
  }

  ConstraintsSetStmt(node: PG16.ConstraintsSetStmt, context: TransformerContext): { ConstraintsSetStmt: PG17.ConstraintsSetStmt } {
    return { ConstraintsSetStmt: node as PG17.ConstraintsSetStmt };
  }

  AlterSystemStmt(node: PG16.AlterSystemStmt, context: TransformerContext): { AlterSystemStmt: PG17.AlterSystemStmt } {
    return { AlterSystemStmt: node as PG17.AlterSystemStmt };
  }

  VacuumRelation(node: PG16.VacuumRelation, context: TransformerContext): { VacuumRelation: PG17.VacuumRelation } {
    return { VacuumRelation: node as PG17.VacuumRelation };
  }

  DropOwnedStmt(node: PG16.DropOwnedStmt, context: TransformerContext): { DropOwnedStmt: PG17.DropOwnedStmt } {
    return { DropOwnedStmt: node as PG17.DropOwnedStmt };
  }

  ReassignOwnedStmt(node: PG16.ReassignOwnedStmt, context: TransformerContext): { ReassignOwnedStmt: PG17.ReassignOwnedStmt } {
    return { ReassignOwnedStmt: node as PG17.ReassignOwnedStmt };
  }

  AlterTSDictionaryStmt(node: PG16.AlterTSDictionaryStmt, context: TransformerContext): { AlterTSDictionaryStmt: PG17.AlterTSDictionaryStmt } {
    return { AlterTSDictionaryStmt: node as PG17.AlterTSDictionaryStmt };
  }

  AlterTSConfigurationStmt(node: PG16.AlterTSConfigurationStmt, context: TransformerContext): { AlterTSConfigurationStmt: PG17.AlterTSConfigurationStmt } {
    return { AlterTSConfigurationStmt: node as PG17.AlterTSConfigurationStmt };
  }

  ClosePortalStmt(node: PG16.ClosePortalStmt, context: TransformerContext): { ClosePortalStmt: PG17.ClosePortalStmt } {
    return { ClosePortalStmt: node as PG17.ClosePortalStmt };
  }

  FetchStmt(node: PG16.FetchStmt, context: TransformerContext): { FetchStmt: PG17.FetchStmt } {
    return { FetchStmt: node as PG17.FetchStmt };
  }

  AlterStatsStmt(node: PG16.AlterStatsStmt, context: TransformerContext): { AlterStatsStmt: PG17.AlterStatsStmt } {
    return { AlterStatsStmt: node as any };
  }

  ObjectWithArgs(node: PG16.ObjectWithArgs, context: TransformerContext): { ObjectWithArgs: PG17.ObjectWithArgs } {
    return { ObjectWithArgs: node as PG17.ObjectWithArgs };
  }

  AlterOperatorStmt(node: PG16.AlterOperatorStmt, context: TransformerContext): { AlterOperatorStmt: PG17.AlterOperatorStmt } {
    return { AlterOperatorStmt: node as PG17.AlterOperatorStmt };
  }

  AlterFdwStmt(node: PG16.AlterFdwStmt, context: TransformerContext): { AlterFdwStmt: PG17.AlterFdwStmt } {
    return { AlterFdwStmt: node as PG17.AlterFdwStmt };
  }

  CreateForeignServerStmt(node: PG16.CreateForeignServerStmt, context: TransformerContext): { CreateForeignServerStmt: PG17.CreateForeignServerStmt } {
    return { CreateForeignServerStmt: node as PG17.CreateForeignServerStmt };
  }

  AlterForeignServerStmt(node: PG16.AlterForeignServerStmt, context: TransformerContext): { AlterForeignServerStmt: PG17.AlterForeignServerStmt } {
    return { AlterForeignServerStmt: node as PG17.AlterForeignServerStmt };
  }

  AlterUserMappingStmt(node: PG16.AlterUserMappingStmt, context: TransformerContext): { AlterUserMappingStmt: PG17.AlterUserMappingStmt } {
    return { AlterUserMappingStmt: node as PG17.AlterUserMappingStmt };
  }

  DropUserMappingStmt(node: PG16.DropUserMappingStmt, context: TransformerContext): { DropUserMappingStmt: PG17.DropUserMappingStmt } {
    return { DropUserMappingStmt: node as PG17.DropUserMappingStmt };
  }

  ImportForeignSchemaStmt(node: PG16.ImportForeignSchemaStmt, context: TransformerContext): { ImportForeignSchemaStmt: PG17.ImportForeignSchemaStmt } {
    return { ImportForeignSchemaStmt: node as PG17.ImportForeignSchemaStmt };
  }

  ClusterStmt(node: PG16.ClusterStmt, context: TransformerContext): { ClusterStmt: PG17.ClusterStmt } {
    return { ClusterStmt: node as PG17.ClusterStmt };
  }

  VacuumStmt(node: PG16.VacuumStmt, context: TransformerContext): { VacuumStmt: PG17.VacuumStmt } {
    return { VacuumStmt: node as PG17.VacuumStmt };
  }

  ExplainStmt(node: PG16.ExplainStmt, context: TransformerContext): { ExplainStmt: PG17.ExplainStmt } {
    return { ExplainStmt: node as PG17.ExplainStmt };
  }

  ReindexStmt(node: PG16.ReindexStmt, context: TransformerContext): { ReindexStmt: PG17.ReindexStmt } {
    return { ReindexStmt: node as PG17.ReindexStmt };
  }

  CallStmt(node: PG16.CallStmt, context: TransformerContext): { CallStmt: PG17.CallStmt } {
    return { CallStmt: node as PG17.CallStmt };
  }

  CreatedbStmt(node: PG16.CreatedbStmt, context: TransformerContext): { CreatedbStmt: PG17.CreatedbStmt } {
    return { CreatedbStmt: node as PG17.CreatedbStmt };
  }

  DropdbStmt(node: PG16.DropdbStmt, context: TransformerContext): { DropdbStmt: PG17.DropdbStmt } {
    return { DropdbStmt: node as PG17.DropdbStmt };
  }

  RenameStmt(node: PG16.RenameStmt, context: TransformerContext): { RenameStmt: PG17.RenameStmt } {
    return { RenameStmt: node as PG17.RenameStmt };
  }

  AlterOwnerStmt(node: PG16.AlterOwnerStmt, context: TransformerContext): { AlterOwnerStmt: PG17.AlterOwnerStmt } {
    return { AlterOwnerStmt: node as PG17.AlterOwnerStmt };
  }

  GrantStmt(node: PG16.GrantStmt, context: TransformerContext): { GrantStmt: PG17.GrantStmt } {
    return { GrantStmt: node as PG17.GrantStmt };
  }

  GrantRoleStmt(node: PG16.GrantRoleStmt, context: TransformerContext): { GrantRoleStmt: PG17.GrantRoleStmt } {
    return { GrantRoleStmt: node as PG17.GrantRoleStmt };
  }

  SecLabelStmt(node: PG16.SecLabelStmt, context: TransformerContext): { SecLabelStmt: PG17.SecLabelStmt } {
    return { SecLabelStmt: node as PG17.SecLabelStmt };
  }

  AlterDefaultPrivilegesStmt(node: PG16.AlterDefaultPrivilegesStmt, context: TransformerContext): { AlterDefaultPrivilegesStmt: PG17.AlterDefaultPrivilegesStmt } {
    return { AlterDefaultPrivilegesStmt: node as PG17.AlterDefaultPrivilegesStmt };
  }

  CreateConversionStmt(node: PG16.CreateConversionStmt, context: TransformerContext): { CreateConversionStmt: PG17.CreateConversionStmt } {
    return { CreateConversionStmt: node as PG17.CreateConversionStmt };
  }

  CreateCastStmt(node: PG16.CreateCastStmt, context: TransformerContext): { CreateCastStmt: PG17.CreateCastStmt } {
    return { CreateCastStmt: node as PG17.CreateCastStmt };
  }

  CreatePLangStmt(node: PG16.CreatePLangStmt, context: TransformerContext): { CreatePLangStmt: PG17.CreatePLangStmt } {
    return { CreatePLangStmt: node as PG17.CreatePLangStmt };
  }

  CreateTransformStmt(node: PG16.CreateTransformStmt, context: TransformerContext): { CreateTransformStmt: PG17.CreateTransformStmt } {
    return { CreateTransformStmt: node as PG17.CreateTransformStmt };
  }

  CreateTrigStmt(node: PG16.CreateTrigStmt, context: TransformerContext): { CreateTrigStmt: PG17.CreateTrigStmt } {
    return { CreateTrigStmt: node as PG17.CreateTrigStmt };
  }

  TriggerTransition(node: PG16.TriggerTransition, context: TransformerContext): { TriggerTransition: PG17.TriggerTransition } {
    return { TriggerTransition: node as PG17.TriggerTransition };
  }

  CreateEventTrigStmt(node: PG16.CreateEventTrigStmt, context: TransformerContext): { CreateEventTrigStmt: PG17.CreateEventTrigStmt } {
    return { CreateEventTrigStmt: node as PG17.CreateEventTrigStmt };
  }

  AlterEventTrigStmt(node: PG16.AlterEventTrigStmt, context: TransformerContext): { AlterEventTrigStmt: PG17.AlterEventTrigStmt } {
    return { AlterEventTrigStmt: node as PG17.AlterEventTrigStmt };
  }

  CreateOpClassStmt(node: PG16.CreateOpClassStmt, context: TransformerContext): { CreateOpClassStmt: PG17.CreateOpClassStmt } {
    return { CreateOpClassStmt: node as PG17.CreateOpClassStmt };
  }

  CreateOpFamilyStmt(node: PG16.CreateOpFamilyStmt, context: TransformerContext): { CreateOpFamilyStmt: PG17.CreateOpFamilyStmt } {
    return { CreateOpFamilyStmt: node as PG17.CreateOpFamilyStmt };
  }

  AlterOpFamilyStmt(node: PG16.AlterOpFamilyStmt, context: TransformerContext): { AlterOpFamilyStmt: PG17.AlterOpFamilyStmt } {
    return { AlterOpFamilyStmt: node as PG17.AlterOpFamilyStmt };
  }

  MergeStmt(node: PG16.MergeStmt, context: TransformerContext): { MergeStmt: PG17.MergeStmt } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = node.relation;
    }
    if (node.sourceRelation !== undefined) {
      result.sourceRelation = this.transform(node.sourceRelation as any, context);
    }
    if (node.joinCondition !== undefined) {
      result.joinCondition = this.transform(node.joinCondition as any, context);
    }
    if (node.mergeWhenClauses !== undefined) {
      result.mergeWhenClauses = Array.isArray(node.mergeWhenClauses)
        ? node.mergeWhenClauses.map(item => this.transform(item as any, context))
        : this.transform(node.mergeWhenClauses as any, context);
    }
    if (node.withClause !== undefined) {
      result.withClause = this.WithClause(node.withClause, context);
    }

    return { MergeStmt: result };
  }

  MergeWhenClause(node: PG16.MergeWhenClause, context: TransformerContext): { MergeWhenClause: PG17.MergeWhenClause } {
    const result: any = {};

    // v17 replaces the boolean matched with matchKind
    result.matchKind = node.matched ? 'MERGE_WHEN_MATCHED' : 'MERGE_WHEN_NOT_MATCHED_BY_TARGET';

    if (node.commandType !== undefined) {
      result.commandType = node.commandType;
    }
    if (node.override !== undefined) {
      result.override = node.override;
    }
    if (node.condition !== undefined) {
      result.condition = this.transform(node.condition as any, context);
    }
    if (node.targetList !== undefined) {
      result.targetList = Array.isArray(node.targetList)
        ? node.targetList.map(item => this.transform(item as any, context))
        : this.transform(node.targetList as any, context);
    }
    if (node.values !== undefined) {
      result.values = Array.isArray(node.values)
        ? node.values.map(item => this.transform(item as any, context))
        : this.transform(node.values as any, context);
    }

    return { MergeWhenClause: result };
  }

  AlterTableMoveAllStmt(node: PG16.AlterTableMoveAllStmt, context: TransformerContext): { AlterTableMoveAllStmt: PG17.AlterTableMoveAllStmt } {
    return { AlterTableMoveAllStmt: node as PG17.AlterTableMoveAllStmt };
  }

  CreateSeqStmt(node: PG16.CreateSeqStmt, context: TransformerContext): { CreateSeqStmt: PG17.CreateSeqStmt } {
    return { CreateSeqStmt: node as PG17.CreateSeqStmt };
  }

  AlterSeqStmt(node: PG16.AlterSeqStmt, context: TransformerContext): { AlterSeqStmt: PG17.AlterSeqStmt } {
    return { AlterSeqStmt: node as PG17.AlterSeqStmt };
  }

  CompositeTypeStmt(node: PG16.CompositeTypeStmt, context: TransformerContext): { CompositeTypeStmt: PG17.CompositeTypeStmt } {
    const result: any = {};

    if (node.typevar !== undefined) {
      result.typevar = this.transform(node.typevar as any, context);
    }
    if (node.coldeflist !== undefined) {
      result.coldeflist = Array.isArray(node.coldeflist)
        ? node.coldeflist.map(item => this.transform(item as any, context))
        : this.transform(node.coldeflist as any, context);
    }

    return { CompositeTypeStmt: result };
  }

  CreateRangeStmt(node: PG16.CreateRangeStmt, context: TransformerContext): { CreateRangeStmt: PG17.CreateRangeStmt } {
    return { CreateRangeStmt: node as PG17.CreateRangeStmt };
  }

  AlterEnumStmt(node: PG16.AlterEnumStmt, context: TransformerContext): { AlterEnumStmt: PG17.AlterEnumStmt } {
    return { AlterEnumStmt: node as PG17.AlterEnumStmt };
  }

  AlterTypeStmt(node: PG16.AlterTypeStmt, context: TransformerContext): { AlterTypeStmt: PG17.AlterTypeStmt } {
    return { AlterTypeStmt: node as PG17.AlterTypeStmt };
  }

  AlterRoleStmt(node: PG16.AlterRoleStmt, context: TransformerContext): { AlterRoleStmt: PG17.AlterRoleStmt } {
    return { AlterRoleStmt: node as PG17.AlterRoleStmt };
  }

  DropRoleStmt(node: PG16.DropRoleStmt, context: TransformerContext): { DropRoleStmt: PG17.DropRoleStmt } {
    return { DropRoleStmt: node as PG17.DropRoleStmt };
  }

  // NOTE PG 17 has a no CreateAggregateStmt?
  // In PostgreSQL 17, the CreateAggregateStmt has been removed from the backend parser infrastructure and replaced by CreateFunctionStmt with a kind = OBJECT_AGGREGATE variant.
  CreateAggregateStmt(node: PG16.DefineStmt, context: TransformerContext): any {
    return { CreateAggregateStmt: node };
  }

  CreateTableAsStmt(node: PG16.CreateTableAsStmt, context: TransformerContext): { CreateTableAsStmt: PG17.CreateTableAsStmt } {
    return { CreateTableAsStmt: node as PG17.CreateTableAsStmt };
  }

  RefreshMatViewStmt(node: PG16.RefreshMatViewStmt, context: TransformerContext): { RefreshMatViewStmt: PG17.RefreshMatViewStmt } {
    return { RefreshMatViewStmt: node as PG17.RefreshMatViewStmt };
  }

  AccessPriv(node: PG16.AccessPriv, context: TransformerContext): { AccessPriv: PG17.AccessPriv } {
    return { AccessPriv: node as PG17.AccessPriv };
  }

  DefineStmt(node: PG16.DefineStmt, context: TransformerContext): { DefineStmt: PG17.DefineStmt } {
    return { DefineStmt: node as PG17.DefineStmt };
  }

  AlterDatabaseStmt(node: PG16.AlterDatabaseStmt, context: TransformerContext): { AlterDatabaseStmt: PG17.AlterDatabaseStmt } {
    return { AlterDatabaseStmt: node as PG17.AlterDatabaseStmt };
  }

  AlterDatabaseRefreshCollStmt(node: PG16.AlterDatabaseRefreshCollStmt, context: TransformerContext): { AlterDatabaseRefreshCollStmt: PG17.AlterDatabaseRefreshCollStmt } {
    return { AlterDatabaseRefreshCollStmt: node as PG17.AlterDatabaseRefreshCollStmt };
  }

  AlterDatabaseSetStmt(node: PG16.AlterDatabaseSetStmt, context: TransformerContext): { AlterDatabaseSetStmt: PG17.AlterDatabaseSetStmt } {
    return { AlterDatabaseSetStmt: node as PG17.AlterDatabaseSetStmt };
  }

  DeclareCursorStmt(node: PG16.DeclareCursorStmt, context: TransformerContext): { DeclareCursorStmt: PG17.DeclareCursorStmt } {
    return { DeclareCursorStmt: node as PG17.DeclareCursorStmt };
  }

  PublicationObjSpec(node: PG16.PublicationObjSpec, context: TransformerContext): { PublicationObjSpec: PG17.PublicationObjSpec } {
    return { PublicationObjSpec: node as PG17.PublicationObjSpec };
  }

  PublicationTable(node: PG16.PublicationTable, context: TransformerContext): { PublicationTable: PG17.PublicationTable } {
    return { PublicationTable: node as PG17.PublicationTable };
  }

  CreateAmStmt(node: PG16.CreateAmStmt, context: TransformerContext): { CreateAmStmt: PG17.CreateAmStmt } {
    return { CreateAmStmt: node as PG17.CreateAmStmt };
  }

  IntoClause(node: PG16.IntoClause, context: TransformerContext): { IntoClause: PG17.IntoClause } {
    return { IntoClause: node as PG17.IntoClause };
  }

  OnConflictExpr(node: PG16.OnConflictExpr, context: TransformerContext): { OnConflictExpr: PG17.OnConflictExpr } {
    return { OnConflictExpr: node as PG17.OnConflictExpr };
  }

  ScanToken(node: PG16.ScanToken, context: TransformerContext): { ScanToken: PG17.ScanToken } {
    return { ScanToken: node as PG17.ScanToken };
  }

  CreateOpClassItem(node: PG16.CreateOpClassItem, context: TransformerContext): { CreateOpClassItem: PG17.CreateOpClassItem } {
    return { CreateOpClassItem: node as PG17.CreateOpClassItem };
  }

  Var(node: PG16.Var, context: TransformerContext): { Var: PG17.Var } {
    return { Var: node as PG17.Var };
  }

  TableFunc(node: PG16.TableFunc, context: TransformerContext): { TableFunc: PG17.TableFunc } {
    return { TableFunc: node as PG17.TableFunc };
  }

  RangeTableFunc(node: PG16.RangeTableFunc, context: TransformerContext): { RangeTableFunc: PG17.RangeTableFunc } {
    return { RangeTableFunc: node as PG17.RangeTableFunc };
  }

  RangeTableFuncCol(node: PG16.RangeTableFuncCol, context: TransformerContext): { RangeTableFuncCol: PG17.RangeTableFuncCol } {
    return { RangeTableFuncCol: node as PG17.RangeTableFuncCol };
  }

  JsonArrayQueryConstructor(node: PG16.JsonArrayQueryConstructor, context: TransformerContext): { JsonArrayQueryConstructor: PG17.JsonArrayQueryConstructor } {
    return { JsonArrayQueryConstructor: node as PG17.JsonArrayQueryConstructor };
  }

  RangeFunction(node: PG16.RangeFunction, context: TransformerContext): { RangeFunction: PG17.RangeFunction } {
    const result: any = {};

    if (node.lateral !== undefined) {
      result.lateral = node.lateral;
    }
    if (node.ordinality !== undefined) {
      result.ordinality = node.ordinality;
    }
    if (node.is_rowsfrom !== undefined) {
      result.is_rowsfrom = node.is_rowsfrom;
    }
    if (node.functions !== undefined) {
      result.functions = Array.isArray(node.functions)
        ? node.functions.map(item => this.transform(item as any, context))
        : this.transform(node.functions as any, context);
    }
    if (node.alias !== undefined) {
      result.alias = this.transform(node.alias as any, context);
    }
    if (node.coldeflist !== undefined) {
      result.coldeflist = Array.isArray(node.coldeflist)
        ? node.coldeflist.map(item => this.transform(item as any, context))
        : this.transform(node.coldeflist as any, context);
    }

    return { RangeFunction: result };
  }

  XmlSerialize(node: PG16.XmlSerialize, context: TransformerContext): { XmlSerialize: PG17.XmlSerialize } {
    const result: any = {};

    if (node.xmloption !== undefined) {
      result.xmloption = node.xmloption;
    }
    if (node.expr !== undefined) {
      result.expr = this.transform(node.expr as any, context);
    }
    if (node.typeName !== undefined) {
      result.typeName = this.transform(node.typeName as any, context);
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { XmlSerialize: result };
  }

  RuleStmt(node: PG16.RuleStmt, context: TransformerContext): { RuleStmt: PG17.RuleStmt } {
    return { RuleStmt: node as PG17.RuleStmt };
  }

  GroupingFunc(node: PG16.GroupingFunc, context: TransformerContext): { GroupingFunc: PG17.GroupingFunc } {
    const result: any = {};

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }
    if (node.refs !== undefined) {
      result.refs = Array.isArray(node.refs)
        ? node.refs.map((item: any) => this.transform(item as any, context))
        : this.transform(node.refs as any, context);
    }
    if (node.agglevelsup !== undefined) {
      result.agglevelsup = node.agglevelsup;
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { GroupingFunc: result };
  }

  MultiAssignRef(node: PG16.MultiAssignRef, context: TransformerContext): { MultiAssignRef: PG17.MultiAssignRef } {
    const result: any = {};

    if (node.source !== undefined) {
      result.source = this.transform(node.source as any, context);
    }
    if (node.colno !== undefined) {
      result.colno = node.colno;
    }
    if (node.ncolumns !== undefined) {
      result.ncolumns = node.ncolumns;
    }

    return { MultiAssignRef: result };
  }

  CurrentOfExpr(node: PG16.CurrentOfExpr, context: TransformerContext): { CurrentOfExpr: PG17.CurrentOfExpr } {
    const result: any = {};

    if (node.cursor_name !== undefined) {
      result.cursor_name = node.cursor_name;
    }
    if (node.cursor_param !== undefined) {
      result.cursor_param = node.cursor_param;
    }

    return { CurrentOfExpr: result };
  }

  TableLikeClause(node: PG16.TableLikeClause, context: TransformerContext): { TableLikeClause: PG17.TableLikeClause } {
    return { TableLikeClause: node as PG17.TableLikeClause };
  }

  AlterFunctionStmt(node: PG16.AlterFunctionStmt, context: TransformerContext): { AlterFunctionStmt: PG17.AlterFunctionStmt } {
    return { AlterFunctionStmt: node as PG17.AlterFunctionStmt };
  }

  AlterObjectSchemaStmt(node: PG16.AlterObjectSchemaStmt, context: TransformerContext): { AlterObjectSchemaStmt: PG17.AlterObjectSchemaStmt } {
    return { AlterObjectSchemaStmt: node as PG17.AlterObjectSchemaStmt };
  }

  AlterRoleSetStmt(node: PG16.AlterRoleSetStmt, context: TransformerContext): { AlterRoleSetStmt: PG17.AlterRoleSetStmt } {
    const result: any = {};

    if (node.role !== undefined) {
      result.role = this.transform(node.role as any, context);
    }
    if (node.database !== undefined) {
      result.database = node.database;
    }
    if (node.setstmt !== undefined) {
      result.setstmt = this.transform(node.setstmt as any, context);
    }

    return { AlterRoleSetStmt: result };
  }

  CreateForeignTableStmt(node: PG16.CreateForeignTableStmt, context: TransformerContext): { CreateForeignTableStmt: PG17.CreateForeignTableStmt } {
    return { CreateForeignTableStmt: node as PG17.CreateForeignTableStmt };
  }

  private getFuncformatValue(node: any, funcname: any, context: TransformerContext): string {
    const functionName = this.getFunctionName(node, funcname);

    if (!functionName) {
      return 'COERCE_EXPLICIT_CALL';
    }

    const hasPgCatalogPrefix = this.hasPgCatalogPrefix(funcname);

    const sqlSyntaxFunctions = [
      'trim', 'ltrim', 'rtrim', 'btrim',
      'position', 'overlay', 'substring',
      'extract', 'timezone', 'xmlexists',
      'current_date', 'current_time', 'current_timestamp',
      'localtime', 'localtimestamp', 'overlaps'
    ];

    // Handle specific functions that depend on pg_catalog prefix
    if (functionName.toLowerCase() === 'substring') {
      if (hasPgCatalogPrefix) {
        return 'COERCE_SQL_SYNTAX';
      }
      return 'COERCE_EXPLICIT_CALL';
    }

    if (functionName.toLowerCase() === 'ltrim') {
      if (hasPgCatalogPrefix) {
        return 'COERCE_SQL_SYNTAX';
      }
      return 'COERCE_EXPLICIT_CALL';
    }

    if (functionName.toLowerCase() === 'btrim') {
      if (hasPgCatalogPrefix) {
        return 'COERCE_SQL_SYNTAX';
      }
      return 'COERCE_EXPLICIT_CALL';
    }

    if (functionName.toLowerCase() === 'pg_collation_for') {
      if (hasPgCatalogPrefix) {
        return 'COERCE_SQL_SYNTAX';
      }
      return 'COERCE_EXPLICIT_CALL';
    }

    if (sqlSyntaxFunctions.includes(functionName.toLowerCase())) {
      return 'COERCE_SQL_SYNTAX';
    }

    return 'COERCE_EXPLICIT_CALL';
  }

  private getFunctionName(node: any, funcname?: any): string | null {
    const names = funcname || node?.funcname;
    if (names && Array.isArray(names) && names.length > 0) {
      const lastName = names[names.length - 1];
      if (lastName && typeof lastName === 'object' && 'String' in lastName) {
        return lastName.String.str || lastName.String.sval;
      }
    }
    return null;
  }

  private hasPgCatalogPrefix(funcname: any): boolean {
    if (funcname && Array.isArray(funcname) && funcname.length >= 2) {
      const firstElement = funcname[0];
      if (firstElement && typeof firstElement === 'object' && 'String' in firstElement) {
        const prefix = firstElement.String.str || firstElement.String.sval;
        return prefix === 'pg_catalog';
      }
    }
    return false;
  }

  RangeTableSample(node: PG16.RangeTableSample, context: TransformerContext): { RangeTableSample: PG17.RangeTableSample } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }
    if (node.method !== undefined) {
      result.method = Array.isArray(node.method)
        ? node.method.map(item => this.transform(item as any, context))
        : this.transform(node.method as any, context);
    }
    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map(item => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }
    if (node.repeatable !== undefined) {
      result.repeatable = this.transform(node.repeatable as any, context);
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { RangeTableSample: result };
  }

  SQLValueFunction(node: PG16.SQLValueFunction, context: TransformerContext): { SQLValueFunction: PG17.SQLValueFunction } {
    const result: any = {};

    if (node.op !== undefined) {
      result.op = node.op;
    }
    if (node.type !== undefined) {
      result.type = node.type;
    }
    if (node.typmod !== undefined) {
      result.typmod = node.typmod;
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { SQLValueFunction: result };
  }

  XmlExpr(node: PG16.XmlExpr, context: TransformerContext): { XmlExpr: PG17.XmlExpr } {
    const result: any = {};

    if (node.op !== undefined) {
      result.op = node.op;
    }
    if (node.name !== undefined) {
      result.name = node.name;
    }
    if (node.named_args !== undefined) {
      result.named_args = Array.isArray(node.named_args)
        ? node.named_args.map(item => this.transform(item as any, context))
        : this.transform(node.named_args as any, context);
    }
    if (node.arg_names !== undefined) {
      result.arg_names = Array.isArray(node.arg_names)
        ? node.arg_names.map(item => this.transform(item as any, context))
        : this.transform(node.arg_names as any, context);
    }
    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map(item => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }
    if (node.xmloption !== undefined) {
      result.xmloption = node.xmloption;
    }
    if (node.type !== undefined) {
      result.type = node.type;
    }
    if (node.typmod !== undefined) {
      result.typmod = node.typmod;
    }
    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { XmlExpr: result };
  }

  RangeSubselect(node: PG16.RangeSubselect, context: TransformerContext): { RangeSubselect: PG17.RangeSubselect } {
    const result: any = {};

    if (node.lateral !== undefined) {
      result.lateral = node.lateral;
    }
    if (node.subquery !== undefined) {
      result.subquery = this.transform(node.subquery as any, context);
    }
    if (node.alias !== undefined) {
      result.alias = this.transform(node.alias as any, context);
    }

    return { RangeSubselect: result };
  }

  SetToDefault(node: PG16.SetToDefault, context: TransformerContext): { SetToDefault: PG17.SetToDefault } {
    const result: any = {};

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { SetToDefault: result };
  }
}
