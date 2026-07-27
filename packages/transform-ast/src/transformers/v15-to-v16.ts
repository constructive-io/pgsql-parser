import * as PG15 from '../15/types';
import * as PG16 from '../16/types';
import { TransformerContext } from './context';

/**
 * V15 to V16 AST Transformer
 * Transforms PostgreSQL v15 AST nodes to v16 format
 */
export class V15ToV16Transformer {

  transform(node: PG15.Node, context: TransformerContext = { parentNodeTypes: [] }): any {
    if (node == null) {
      return null;
    }

    if (typeof node === 'number' || node instanceof Number) {
      return node;
    }

    if (typeof node === 'string') {
      return node;
    }

    if (Array.isArray(node)) {
      return node.map(item => this.transform(item, context));
    }

    try {
      return this.visit(node, context);
    } catch (error) {
      const nodeType = Object.keys(node)[0];
      throw new Error(`Error transforming ${nodeType}: ${(error as Error).message}`);
    }
  }

  visit(node: PG15.Node, context: TransformerContext = { parentNodeTypes: [] }): any {
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
        parentNodeTypes: [...(context.parentNodeTypes || []), nodeType]
      };
      return (this[methodName] as any)(nodeData, childContext);
    }

    // If no specific method, return the node as-is
    return node;
  }

  getNodeType(node: PG15.Node): any {
    const keys = Object.keys(node);

    // Handle parse result structure with version and stmts
    if (keys.length === 2 && keys.includes('version') && keys.includes('stmts')) {
      return 'ParseResult';
    }

    return keys[0];
  }

  getNodeData(node: PG15.Node): any {
    const keys = Object.keys(node);
    if (keys.length === 1 && typeof (node as any)[keys[0]] === 'object') {
      return (node as any)[keys[0]];
    }
    return node;
  }

  ParseResult(node: PG15.ParseResult, context: TransformerContext): PG16.ParseResult {

    if (node && typeof node === 'object' && 'version' in node && 'stmts' in node) {
      return {
        version: 160000, // PG16 version
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

    return node as PG16.ParseResult;
  }

  RawStmt(node: PG15.RawStmt, context: TransformerContext): { RawStmt: PG16.RawStmt } {
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

  SelectStmt(node: PG15.SelectStmt, context: TransformerContext): { SelectStmt: PG16.SelectStmt } {
    const result: any = {};

    if (node.distinctClause !== undefined) {
      result.distinctClause = Array.isArray(node.distinctClause)
        ? node.distinctClause.map((item: any) => this.transform(item as any, context))
        : this.transform(node.distinctClause as any, context);
    }

    if (node.intoClause !== undefined) {
      result.intoClause = this.transform(node.intoClause as any, context);
    }

    if (node.targetList !== undefined) {
      result.targetList = Array.isArray(node.targetList)
        ? node.targetList.map((item: any) => this.transform(item as any, context))
        : this.transform(node.targetList as any, context);
    }

    if (node.fromClause !== undefined) {
      result.fromClause = Array.isArray(node.fromClause)
        ? node.fromClause.map((item: any) => this.transform(item as any, context))
        : this.transform(node.fromClause as any, context);
    }

    if (node.whereClause !== undefined) {
      result.whereClause = this.transform(node.whereClause as any, context);
    }

    if (node.groupClause !== undefined) {
      result.groupClause = Array.isArray(node.groupClause)
        ? node.groupClause.map((item: any) => this.transform(item as any, context))
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
        ? node.windowClause.map((item: any) => this.transform(item as any, context))
        : this.transform(node.windowClause as any, context);
    }

    if (node.valuesLists !== undefined) {
      result.valuesLists = Array.isArray(node.valuesLists)
        ? node.valuesLists.map((item: any) => this.transform(item as any, context))
        : this.transform(node.valuesLists as any, context);
    }

    if (node.sortClause !== undefined) {
      result.sortClause = Array.isArray(node.sortClause)
        ? node.sortClause.map((item: any) => this.transform(item as any, context))
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
        ? node.lockingClause.map((item: any) => this.transform(item as any, context))
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

  A_Expr(node: PG15.A_Expr, context: TransformerContext): { A_Expr: PG16.A_Expr } {
    const result: any = {};

    if (node.kind !== undefined) {
      result.kind = node.kind;
    }

    if (node.name !== undefined) {
      result.name = Array.isArray(node.name)
        ? node.name.map((item: any) => this.transform(item as any, context))
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

  InsertStmt(node: PG15.InsertStmt, context: TransformerContext): { InsertStmt: PG16.InsertStmt } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }

    if (node.cols !== undefined) {
      result.cols = Array.isArray(node.cols)
        ? node.cols.map((item: any) => this.transform(item as any, context))
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
        ? node.returningList.map((item: any) => this.transform(item as any, context))
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

  UpdateStmt(node: PG15.UpdateStmt, context: TransformerContext): { UpdateStmt: PG16.UpdateStmt } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }

    if (node.targetList !== undefined) {
      result.targetList = Array.isArray(node.targetList)
        ? node.targetList.map((item: any) => this.transform(item as any, context))
        : this.transform(node.targetList as any, context);
    }

    if (node.whereClause !== undefined) {
      result.whereClause = this.transform(node.whereClause as any, context);
    }

    if (node.fromClause !== undefined) {
      result.fromClause = Array.isArray(node.fromClause)
        ? node.fromClause.map((item: any) => this.transform(item as any, context))
        : this.transform(node.fromClause as any, context);
    }

    if (node.returningList !== undefined) {
      result.returningList = Array.isArray(node.returningList)
        ? node.returningList.map((item: any) => this.transform(item as any, context))
        : this.transform(node.returningList as any, context);
    }

    if (node.withClause !== undefined) {
      result.withClause = this.transform(node.withClause as any, context);
    }

    return { UpdateStmt: result };
  }

  DeleteStmt(node: PG15.DeleteStmt, context: TransformerContext): { DeleteStmt: PG16.DeleteStmt } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }

    if (node.usingClause !== undefined) {
      result.usingClause = Array.isArray(node.usingClause)
        ? node.usingClause.map((item: any) => this.transform(item as any, context))
        : this.transform(node.usingClause as any, context);
    }

    if (node.whereClause !== undefined) {
      result.whereClause = this.transform(node.whereClause as any, context);
    }

    if (node.returningList !== undefined) {
      result.returningList = Array.isArray(node.returningList)
        ? node.returningList.map((item: any) => this.transform(item as any, context))
        : this.transform(node.returningList as any, context);
    }

    if (node.withClause !== undefined) {
      result.withClause = this.transform(node.withClause as any, context);
    }

    return { DeleteStmt: result };
  }

  WithClause(node: PG15.WithClause, context: TransformerContext): { WithClause: PG16.WithClause } {
    const result: any = {};

    if (node.ctes !== undefined) {
      result.ctes = Array.isArray(node.ctes)
        ? node.ctes.map((item: any) => this.transform(item as any, context))
        : this.transform(node.ctes as any, context);
    }

    if (node.recursive !== undefined) {
      result.recursive = node.recursive;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { WithClause: result };
  }

  ResTarget(node: PG15.ResTarget, context: TransformerContext): { ResTarget: PG16.ResTarget } {
    const result: any = {};

    if (node.name !== undefined) {
      result.name = node.name;
    }

    if (node.indirection !== undefined) {
      result.indirection = Array.isArray(node.indirection)
        ? node.indirection.map((item: any) => this.transform(item as any, context))
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

  BoolExpr(node: PG15.BoolExpr, context: TransformerContext): { BoolExpr: PG16.BoolExpr } {
    const result: any = {};

    if (node.boolop !== undefined) {
      result.boolop = node.boolop;
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { BoolExpr: result };
  }

  FuncCall(node: PG15.FuncCall, context: TransformerContext): { FuncCall: PG16.FuncCall } | { ColumnRef: PG16.ColumnRef } {
    const result: any = {};

    if (node.funcname !== undefined) {

      if (node.funcname.length === 1 && (node.funcname[0] as any)?.String?.sval === 'json_object') {
        result.funcname = [
          {
            String: { sval: 'pg_catalog' }
          },
          { String: { sval: 'json_object' } }
        ];
      } else if (node.funcname.length === 2 && 
                 (node.funcname[0] as any)?.String?.sval === 'pg_catalog' && 
                 (node.funcname[1] as any)?.String?.sval === 'system_user' &&
                 node.funcformat === 'COERCE_SQL_SYNTAX') {
        return {
          ColumnRef: {
            fields: [
              { String: { sval: 'system_user' } }
            ]
          }
        };
      } else {
        result.funcname = Array.isArray(node.funcname)
          ? node.funcname.map((item: any) => this.transform(item as any, context))
          : this.transform(node.funcname as any, context);
      }
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.agg_order !== undefined) {
      result.agg_order = Array.isArray(node.agg_order)
        ? node.agg_order.map((item: any) => this.transform(item as any, context))
        : this.transform(node.agg_order as any, context);
    }

    if (node.agg_filter !== undefined) {
      result.agg_filter = this.transform(node.agg_filter as any, context);
    }

    if (node.over !== undefined) {
      result.over = this.transform(node.over as any, context);
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

    if (node.funcformat !== undefined) {
      result.funcformat = node.funcformat;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { FuncCall: result };
  }

  FuncExpr(node: PG15.FuncExpr, context: TransformerContext): { FuncExpr: PG16.FuncExpr } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.funcid !== undefined) {
      result.funcid = node.funcid;
    }

    if (node.funcresulttype !== undefined) {
      result.funcresulttype = node.funcresulttype;
    }

    if (node.funcretset !== undefined) {
      result.funcretset = node.funcretset;
    }

    if (node.funcvariadic !== undefined) {
      result.funcvariadic = node.funcvariadic;
    }

    if (node.funcformat !== undefined) {
      result.funcformat = node.funcformat;
    }

    if (node.funccollid !== undefined) {
      result.funccollid = node.funccollid;
    }

    if (node.inputcollid !== undefined) {
      result.inputcollid = node.inputcollid;
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { FuncExpr: result };
  }

  A_Const(node: PG15.A_Const, context: TransformerContext): { A_Const: PG16.A_Const } {
    const result: any = { ...node };

    if (result.val) {
      const val: any = result.val;
      if (val.String && val.String.str !== undefined) {
        result.sval = val.String.str;
        delete result.val;
      } else if (val.Integer !== undefined) {
        result.ival = val.Integer;
        delete result.val;
      } else if (val.Float && val.Float.str !== undefined) {
        result.fval = val.Float.str;
        delete result.val;
      } else if (val.BitString && val.BitString.str !== undefined) {
        result.bsval = val.BitString.str;
        delete result.val;
      } else if (val.Null !== undefined) {
        delete result.val;
      }
    }

    return { A_Const: result };
  }

  ColumnRef(node: PG15.ColumnRef, context: TransformerContext): { ColumnRef: PG16.ColumnRef } | { FuncCall: PG16.FuncCall } {
    if (node.fields && Array.isArray(node.fields) && node.fields.length === 1) {
      const field = node.fields[0];
      if ((field as any)?.String?.sval === 'system_user') {
        return {
          FuncCall: {
            funcname: [
              { String: { sval: 'pg_catalog' } },
              { String: { sval: 'system_user' } }
            ],
            funcformat: 'COERCE_SQL_SYNTAX'
          }
        };
      }
    }

    const result: any = {};

    if (node.fields !== undefined) {
      result.fields = Array.isArray(node.fields)
        ? node.fields.map((item: any) => this.transform(item as any, context))
        : this.transform(node.fields as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { ColumnRef: result };
  }

  TypeName(node: PG15.TypeName, context: TransformerContext): { TypeName: PG16.TypeName } {
    const result: any = {};

    if (node.names !== undefined) {
      result.names = Array.isArray(node.names)
        ? node.names.map((item: any) => this.transform(item as any, context))
        : this.transform(node.names as any, context);
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
        ? node.typmods.map((item: any) => this.transform(item as any, context))
        : this.transform(node.typmods as any, context);
    }

    if (node.typemod !== undefined) {
      result.typemod = node.typemod;
    }

    if (node.arrayBounds !== undefined) {
      const childContext: TransformerContext = {
        ...context,
        parentNodeTypes: [...(context.parentNodeTypes || []), 'TypeName']
      };
      result.arrayBounds = Array.isArray(node.arrayBounds)
        ? node.arrayBounds.map((item: any) => this.transform(item as any, childContext))
        : this.transform(node.arrayBounds as any, childContext);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { TypeName: result };
  }

  Alias(node: PG15.Alias, context: TransformerContext): { Alias: PG16.Alias } {
    const result: any = {};

    if (node.aliasname !== undefined) {
      result.aliasname = node.aliasname;
    }

    if (node.colnames !== undefined) {
      result.colnames = Array.isArray(node.colnames)
        ? node.colnames.map((item: any) => this.transform(item as any, context))
        : this.transform(node.colnames as any, context);
    }

    return { Alias: result };
  }

  RangeVar(node: PG15.RangeVar, context: TransformerContext): { RangeVar: PG16.RangeVar } | { RangeFunction: PG16.RangeFunction } {
    if (node.relname === 'system_user' && node.inh === true && node.relpersistence === 'p') {
      return {
        RangeFunction: {
          functions: [
            {
              List: {
                items: [
                  {
                    FuncCall: {
                      funcname: [
                        { String: { sval: 'pg_catalog' } },
                        { String: { sval: 'system_user' } }
                      ],
                      funcformat: 'COERCE_SQL_SYNTAX'
                    }
                  },
                  {} as any
                ]
              }
            }
          ]
        }
      };
    }

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

  A_ArrayExpr(node: PG15.A_ArrayExpr, context: TransformerContext): { A_ArrayExpr: PG16.A_ArrayExpr } {
    const result: any = {};

    if (node.elements !== undefined) {
      result.elements = Array.isArray(node.elements)
        ? node.elements.map((item: any) => this.transform(item as any, context))
        : this.transform(node.elements as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { A_ArrayExpr: result };
  }

  A_Indices(node: PG15.A_Indices, context: TransformerContext): { A_Indices: PG16.A_Indices } {
    const result: any = {};

    if (node.is_slice !== undefined) {
      result.is_slice = node.is_slice;
    }

    if (node.lidx !== undefined) {
      result.lidx = this.transform(node.lidx as any, context);
    }

    if (node.uidx !== undefined) {
      result.uidx = this.transform(node.uidx as any, context);
    }

    return { A_Indices: result };
  }

  A_Indirection(node: PG15.A_Indirection, context: TransformerContext): { A_Indirection: PG16.A_Indirection } {
    const result: any = {};

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.indirection !== undefined) {
      result.indirection = Array.isArray(node.indirection)
        ? node.indirection.map((item: any) => this.transform(item as any, context))
        : this.transform(node.indirection as any, context);
    }

    return { A_Indirection: result };
  }

  A_Star(node: PG15.A_Star, context: TransformerContext): { A_Star: PG16.A_Star } {
    const result: any = {};

    return { A_Star: result };
  }

  CaseExpr(node: PG15.CaseExpr, context: TransformerContext): { CaseExpr: PG16.CaseExpr } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.casetype !== undefined) {
      result.casetype = node.casetype;
    }

    if (node.casecollid !== undefined) {
      result.casecollid = node.casecollid;
    }

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.defresult !== undefined) {
      result.defresult = this.transform(node.defresult as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { CaseExpr: result };
  }

  CoalesceExpr(node: PG15.CoalesceExpr, context: TransformerContext): { CoalesceExpr: PG16.CoalesceExpr } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.coalescetype !== undefined) {
      result.coalescetype = node.coalescetype;
    }

    if (node.coalescecollid !== undefined) {
      result.coalescecollid = node.coalescecollid;
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { CoalesceExpr: result };
  }

  TypeCast(node: PG15.TypeCast, context: TransformerContext): { TypeCast: PG16.TypeCast } {
    const result: any = {};

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.typeName !== undefined) {
      const childContext: TransformerContext = {
        ...context,
        parentNodeTypes: [...(context.parentNodeTypes || []), 'TypeCast']
      };
      result.typeName = this.TypeName(node.typeName as any, childContext).TypeName;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { TypeCast: result };
  }

  CollateClause(node: PG15.CollateClause, context: TransformerContext): { CollateClause: PG16.CollateClause } {
    const result: any = {};

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.collname !== undefined) {
      result.collname = Array.isArray(node.collname)
        ? node.collname.map((item: any) => this.transform(item as any, context))
        : this.transform(node.collname as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { CollateClause: result };
  }

  BooleanTest(node: PG15.BooleanTest, context: TransformerContext): { BooleanTest: PG16.BooleanTest } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.booltesttype !== undefined) {
      result.booltesttype = node.booltesttype;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { BooleanTest: result };
  }

  NullTest(node: PG15.NullTest, context: TransformerContext): { NullTest: PG16.NullTest } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.nulltesttype !== undefined) {
      result.nulltesttype = node.nulltesttype;
    }

    if (node.argisrow !== undefined) {
      result.argisrow = node.argisrow;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { NullTest: result };
  }

  String(node: PG15.String, context: TransformerContext): { String: PG16.String } {
    const result: any = { ...node };
    return { String: result };
  }

  Integer(node: PG15.Integer, context: TransformerContext): { Integer: PG16.Integer } {
    const result: any = { ...node };
    return { Integer: result };
  }

  Float(node: PG15.Float, context: TransformerContext): { Float: PG16.Float } {
    const result: any = { ...node };
    return { Float: result };
  }

  Boolean(node: PG15.Boolean, context: TransformerContext): { Boolean: PG16.Boolean } {
    const result: any = { ...node };
    return { Boolean: result };
  }

  BitString(node: PG15.BitString, context: TransformerContext): { BitString: PG16.BitString } {
    const result: any = { ...node };
    return { BitString: result };
  }

  Null(node: PG15.Node, context: TransformerContext): { Null: {} } {
    return { Null: {} };
  }

  List(node: PG15.List, context: TransformerContext): { List: PG16.List } {
    const result: any = {};

    if (node.items !== undefined) {
      result.items = Array.isArray(node.items)
        ? node.items.map((item: any) => {
            const transformed = this.transform(item as any, context);
            if (transformed === null) {
              return {};
            }
            return transformed;
          })
        : this.transform(node.items as any, context);
    }

    return { List: result };
  }

  CreateStmt(node: PG15.CreateStmt, context: TransformerContext): { CreateStmt: PG16.CreateStmt } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }

    if (node.tableElts !== undefined) {
      result.tableElts = Array.isArray(node.tableElts)
        ? node.tableElts.map((item: any) => this.transform(item as any, context))
        : this.transform(node.tableElts as any, context);
    }

    if (node.inhRelations !== undefined) {
      result.inhRelations = Array.isArray(node.inhRelations)
        ? node.inhRelations.map((item: any) => this.transform(item as any, context))
        : this.transform(node.inhRelations as any, context);
    }

    if (node.partbound !== undefined) {
      result.partbound = this.transform(node.partbound as any, context);
    }

    if (node.partspec !== undefined) {
      // Handle partspec transformation directly since it's a plain object, not a wrapped node
      const partspec: any = { ...node.partspec };

      if (partspec.strategy !== undefined) {
        const strategyMap: Record<string, string> = {
          'range': 'PARTITION_STRATEGY_RANGE',
          'list': 'PARTITION_STRATEGY_LIST',
          'hash': 'PARTITION_STRATEGY_HASH'
        };
        partspec.strategy = strategyMap[partspec.strategy] || partspec.strategy;
      }

      if (partspec.partParams !== undefined) {
        partspec.partParams = Array.isArray(partspec.partParams)
          ? partspec.partParams.map((item: any) => this.transform(item as any, context))
          : this.transform(partspec.partParams as any, context);
      }

      result.partspec = partspec;
    }

    if (node.ofTypename !== undefined) {
      result.ofTypename = this.transform(node.ofTypename as any, context);
    }

    if (node.constraints !== undefined) {
      result.constraints = Array.isArray(node.constraints)
        ? node.constraints.map((item: any) => this.transform(item as any, context))
        : this.transform(node.constraints as any, context);
    }

    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map((item: any) => this.transform(item as any, context))
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

  ColumnDef(node: PG15.ColumnDef, context: TransformerContext): { ColumnDef: PG16.ColumnDef } {
    const result: any = {};

    if (node.colname !== undefined) {
      result.colname = node.colname;
    }

    if (node.typeName !== undefined) {
      const transformedTypeName = this.transform({ TypeName: node.typeName } as any, context);
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
        ? node.constraints.map((item: any) => this.transform(item as any, context))
        : this.transform(node.constraints as any, context);
    }

    if (node.fdwoptions !== undefined) {
      result.fdwoptions = Array.isArray(node.fdwoptions)
        ? node.fdwoptions.map((item: any) => this.transform(item as any, context))
        : this.transform(node.fdwoptions as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { ColumnDef: result };
  }

  Constraint(node: PG15.Constraint, context: TransformerContext): { Constraint: PG16.Constraint } {
    const result: any = {};

    if (node.contype !== undefined) {
      result.contype = node.contype;
    }

    if (node.conname !== undefined) {
      result.conname = node.conname;
    }

    if (node.deferrable !== undefined) {
      result.deferrable = node.deferrable;
    }

    if (node.initdeferred !== undefined) {
      result.initdeferred = node.initdeferred;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    if (node.is_no_inherit !== undefined) {
      result.is_no_inherit = node.is_no_inherit;
    }

    if (node.raw_expr !== undefined) {
      result.raw_expr = this.transform(node.raw_expr as any, context);
    }

    if (node.cooked_expr !== undefined) {
      result.cooked_expr = node.cooked_expr;
    }

    if (node.generated_when !== undefined) {
      result.generated_when = node.generated_when;
    }

    if (node.keys !== undefined) {
      result.keys = Array.isArray(node.keys)
        ? node.keys.map((item: any) => this.transform(item as any, context))
        : this.transform(node.keys as any, context);
    }

    if (node.including !== undefined) {
      result.including = Array.isArray(node.including)
        ? node.including.map((item: any) => this.transform(item as any, context))
        : this.transform(node.including as any, context);
    }

    if (node.exclusions !== undefined) {
      result.exclusions = Array.isArray(node.exclusions)
        ? node.exclusions.map((item: any) => this.transform(item as any, context))
        : this.transform(node.exclusions as any, context);
    }

    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map((item: any) => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }

    if (node.indexname !== undefined) {
      result.indexname = node.indexname;
    }

    if (node.indexspace !== undefined) {
      result.indexspace = node.indexspace;
    }

    if (node.reset_default_tblspc !== undefined) {
      result.reset_default_tblspc = node.reset_default_tblspc;
    }

    if (node.access_method !== undefined) {
      result.access_method = node.access_method;
    }

    if (node.where_clause !== undefined) {
      result.where_clause = this.transform(node.where_clause as any, context);
    }

    if (node.pktable !== undefined) {
      result.pktable = this.transform(node.pktable as any, context);
    }

    if (node.fk_attrs !== undefined) {
      result.fk_attrs = Array.isArray(node.fk_attrs)
        ? node.fk_attrs.map((item: any) => this.transform(item as any, context))
        : this.transform(node.fk_attrs as any, context);
    }

    if (node.pk_attrs !== undefined) {
      result.pk_attrs = Array.isArray(node.pk_attrs)
        ? node.pk_attrs.map((item: any) => this.transform(item as any, context))
        : this.transform(node.pk_attrs as any, context);
    }

    if (node.fk_matchtype !== undefined) {
      result.fk_matchtype = node.fk_matchtype;
    }

    if (node.fk_upd_action !== undefined) {
      result.fk_upd_action = node.fk_upd_action;
    }

    if (node.fk_del_action !== undefined) {
      result.fk_del_action = node.fk_del_action;
    }

    if (node.old_conpfeqop !== undefined) {
      result.old_conpfeqop = Array.isArray(node.old_conpfeqop)
        ? node.old_conpfeqop.map((item: any) => this.transform(item as any, context))
        : this.transform(node.old_conpfeqop as any, context);
    }

    if (node.old_pktable_oid !== undefined) {
      result.old_pktable_oid = node.old_pktable_oid;
    }

    if (node.skip_validation !== undefined) {
      result.skip_validation = node.skip_validation;
    }

    if (node.initially_valid !== undefined) {
      result.initially_valid = node.initially_valid;
    }

    if (node.nulls_not_distinct !== undefined) {
      result.nulls_not_distinct = node.nulls_not_distinct;
    }

    return { Constraint: result };
  }

  SubLink(node: PG15.SubLink, context: TransformerContext): { SubLink: PG16.SubLink } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.subLinkType !== undefined) {
      result.subLinkType = node.subLinkType;
    }

    if (node.subLinkId !== undefined) {
      result.subLinkId = node.subLinkId;
    }

    if (node.testexpr !== undefined) {
      result.testexpr = this.transform(node.testexpr as any, context);
    }

    if (node.operName !== undefined) {
      result.operName = Array.isArray(node.operName)
        ? node.operName.map((item: any) => this.transform(item as any, context))
        : this.transform(node.operName as any, context);
    }

    if (node.subselect !== undefined) {
      result.subselect = this.transform(node.subselect as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { SubLink: result };
  }

  CaseWhen(node: PG15.CaseWhen, context: TransformerContext): { CaseWhen: PG16.CaseWhen } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.expr !== undefined) {
      result.expr = this.transform(node.expr as any, context);
    }

    if (node.result !== undefined) {
      result.result = this.transform(node.result as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { CaseWhen: result };
  }

  WindowDef(node: PG15.WindowDef, context: TransformerContext): { WindowDef: PG16.WindowDef } {
    const result: any = {};

    if (node.name !== undefined) {
      result.name = node.name;
    }

    if (node.refname !== undefined) {
      result.refname = node.refname;
    }

    if (node.partitionClause !== undefined) {
      result.partitionClause = Array.isArray(node.partitionClause)
        ? node.partitionClause.map((item: any) => this.transform(item as any, context))
        : this.transform(node.partitionClause as any, context);
    }

    if (node.orderClause !== undefined) {
      result.orderClause = Array.isArray(node.orderClause)
        ? node.orderClause.map((item: any) => this.transform(item as any, context))
        : this.transform(node.orderClause as any, context);
    }

    if (node.frameOptions !== undefined) {
      result.frameOptions = node.frameOptions;
    }

    if (node.startOffset !== undefined) {
      result.startOffset = this.transform(node.startOffset as any, context);
    }

    if (node.endOffset !== undefined) {
      result.endOffset = this.transform(node.endOffset as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { WindowDef: result };
  }

  SortBy(node: PG15.SortBy, context: TransformerContext): { SortBy: PG16.SortBy } {
    const result: any = {};

    if (node.node !== undefined) {
      result.node = this.transform(node.node as any, context);
    }

    if (node.sortby_dir !== undefined) {
      result.sortby_dir = node.sortby_dir;
    }

    if (node.sortby_nulls !== undefined) {
      result.sortby_nulls = node.sortby_nulls;
    }

    if (node.useOp !== undefined) {
      result.useOp = Array.isArray(node.useOp)
        ? node.useOp.map((item: any) => this.transform(item as any, context))
        : this.transform(node.useOp as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { SortBy: result };
  }

  GroupingSet(node: PG15.GroupingSet, context: TransformerContext): { GroupingSet: PG16.GroupingSet } {
    const result: any = {};

    if (node.kind !== undefined) {
      result.kind = node.kind;
    }

    if (node.content !== undefined) {
      result.content = Array.isArray(node.content)
        ? node.content.map((item: any) => this.transform(item as any, context))
        : this.transform(node.content as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { GroupingSet: result };
  }

  CommonTableExpr(node: PG15.CommonTableExpr, context: TransformerContext): { CommonTableExpr: PG16.CommonTableExpr } {
    const result: any = {};

    if (node.ctename !== undefined) {
      result.ctename = node.ctename;
    }

    if (node.aliascolnames !== undefined) {
      result.aliascolnames = Array.isArray(node.aliascolnames)
        ? node.aliascolnames.map((item: any) => this.transform(item as any, context))
        : this.transform(node.aliascolnames as any, context);
    }

    if (node.ctematerialized !== undefined) {
      result.ctematerialized = node.ctematerialized;
    }

    if (node.ctequery !== undefined) {
      result.ctequery = this.transform(node.ctequery as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    if (node.cterecursive !== undefined) {
      result.cterecursive = node.cterecursive;
    }

    if (node.cterefcount !== undefined) {
      result.cterefcount = node.cterefcount;
    }

    if (node.ctecolnames !== undefined) {
      result.ctecolnames = Array.isArray(node.ctecolnames)
        ? node.ctecolnames.map((item: any) => this.transform(item as any, context))
        : this.transform(node.ctecolnames as any, context);
    }

    if (node.ctecoltypes !== undefined) {
      result.ctecoltypes = Array.isArray(node.ctecoltypes)
        ? node.ctecoltypes.map((item: any) => this.transform(item as any, context))
        : this.transform(node.ctecoltypes as any, context);
    }

    if (node.ctecoltypmods !== undefined) {
      result.ctecoltypmods = Array.isArray(node.ctecoltypmods)
        ? node.ctecoltypmods.map((item: any) => this.transform(item as any, context))
        : this.transform(node.ctecoltypmods as any, context);
    }

    if (node.ctecolcollations !== undefined) {
      result.ctecolcollations = Array.isArray(node.ctecolcollations)
        ? node.ctecolcollations.map((item: any) => this.transform(item as any, context))
        : this.transform(node.ctecolcollations as any, context);
    }

    return { CommonTableExpr: result };
  }

  ParamRef(node: PG15.ParamRef, context: TransformerContext): { ParamRef: PG16.ParamRef } {
    const result: any = {};

    if (node.number !== undefined) {
      result.number = node.number;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { ParamRef: result };
  }

  LockingClause(node: PG15.LockingClause, context: TransformerContext): { LockingClause: PG16.LockingClause } {
    const result: any = {};

    if (node.lockedRels !== undefined) {
      result.lockedRels = Array.isArray(node.lockedRels)
        ? node.lockedRels.map((item: any) => this.transform(item as any, context))
        : this.transform(node.lockedRels as any, context);
    }

    if (node.strength !== undefined) {
      result.strength = node.strength;
    }

    if (node.waitPolicy !== undefined) {
      result.waitPolicy = node.waitPolicy;
    }

    return { LockingClause: result };
  }

  MinMaxExpr(node: PG15.MinMaxExpr, context: TransformerContext): { MinMaxExpr: PG16.MinMaxExpr } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.minmaxtype !== undefined) {
      result.minmaxtype = node.minmaxtype;
    }

    if (node.minmaxcollid !== undefined) {
      result.minmaxcollid = node.minmaxcollid;
    }

    if (node.inputcollid !== undefined) {
      result.inputcollid = node.inputcollid;
    }

    if (node.op !== undefined) {
      result.op = node.op;
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { MinMaxExpr: result };
  }

  RowExpr(node: PG15.RowExpr, context: TransformerContext): { RowExpr: PG16.RowExpr } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.row_typeid !== undefined) {
      result.row_typeid = node.row_typeid;
    }

    if (node.row_format !== undefined) {
      result.row_format = node.row_format;
    }

    if (node.colnames !== undefined) {
      result.colnames = Array.isArray(node.colnames)
        ? node.colnames.map((item: any) => this.transform(item as any, context))
        : this.transform(node.colnames as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { RowExpr: result };
  }

  OpExpr(node: PG15.OpExpr, context: TransformerContext): { OpExpr: PG16.OpExpr } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.opno !== undefined) {
      result.opno = node.opno;
    }

    if (node.opfuncid !== undefined) {
      result.opfuncid = node.opfuncid;
    }

    if (node.opresulttype !== undefined) {
      result.opresulttype = node.opresulttype;
    }

    if (node.opretset !== undefined) {
      result.opretset = node.opretset;
    }

    if (node.opcollid !== undefined) {
      result.opcollid = node.opcollid;
    }

    if (node.inputcollid !== undefined) {
      result.inputcollid = node.inputcollid;
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { OpExpr: result };
  }

  DistinctExpr(node: PG15.DistinctExpr, context: TransformerContext): { DistinctExpr: PG16.DistinctExpr } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.opno !== undefined) {
      result.opno = node.opno;
    }

    if (node.opfuncid !== undefined) {
      result.opfuncid = node.opfuncid;
    }

    if (node.opresulttype !== undefined) {
      result.opresulttype = node.opresulttype;
    }

    if (node.opretset !== undefined) {
      result.opretset = node.opretset;
    }

    if (node.opcollid !== undefined) {
      result.opcollid = node.opcollid;
    }

    if (node.inputcollid !== undefined) {
      result.inputcollid = node.inputcollid;
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { DistinctExpr: result };
  }

  NullIfExpr(node: PG15.NullIfExpr, context: TransformerContext): { NullIfExpr: PG16.NullIfExpr } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.opno !== undefined) {
      result.opno = node.opno;
    }

    if (node.opfuncid !== undefined) {
      result.opfuncid = node.opfuncid;
    }

    if (node.opresulttype !== undefined) {
      result.opresulttype = node.opresulttype;
    }

    if (node.opretset !== undefined) {
      result.opretset = node.opretset;
    }

    if (node.opcollid !== undefined) {
      result.opcollid = node.opcollid;
    }

    if (node.inputcollid !== undefined) {
      result.inputcollid = node.inputcollid;
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { NullIfExpr: result };
  }

  ScalarArrayOpExpr(node: PG15.ScalarArrayOpExpr, context: TransformerContext): { ScalarArrayOpExpr: PG16.ScalarArrayOpExpr } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.opno !== undefined) {
      result.opno = node.opno;
    }

    if (node.opfuncid !== undefined) {
      result.opfuncid = node.opfuncid;
    }

    if (node.hashfuncid !== undefined) {
      result.hashfuncid = node.hashfuncid;
    }

    if (node.useOr !== undefined) {
      result.useOr = node.useOr;
    }

    if (node.inputcollid !== undefined) {
      result.inputcollid = node.inputcollid;
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { ScalarArrayOpExpr: result };
  }

  Aggref(node: PG15.Aggref, context: TransformerContext): { Aggref: PG16.Aggref } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.aggfnoid !== undefined) {
      result.aggfnoid = node.aggfnoid;
    }

    if (node.aggtype !== undefined) {
      result.aggtype = node.aggtype;
    }

    if (node.aggcollid !== undefined) {
      result.aggcollid = node.aggcollid;
    }

    if (node.inputcollid !== undefined) {
      result.inputcollid = node.inputcollid;
    }

    if (node.aggtranstype !== undefined) {
      result.aggtranstype = node.aggtranstype;
    }

    if (node.aggargtypes !== undefined) {
      result.aggargtypes = Array.isArray(node.aggargtypes)
        ? node.aggargtypes.map((item: any) => this.transform(item as any, context))
        : this.transform(node.aggargtypes as any, context);
    }

    if (node.aggdirectargs !== undefined) {
      result.aggdirectargs = Array.isArray(node.aggdirectargs)
        ? node.aggdirectargs.map((item: any) => this.transform(item as any, context))
        : this.transform(node.aggdirectargs as any, context);
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.aggorder !== undefined) {
      result.aggorder = Array.isArray(node.aggorder)
        ? node.aggorder.map((item: any) => this.transform(item as any, context))
        : this.transform(node.aggorder as any, context);
    }

    if (node.aggdistinct !== undefined) {
      result.aggdistinct = Array.isArray(node.aggdistinct)
        ? node.aggdistinct.map((item: any) => this.transform(item as any, context))
        : this.transform(node.aggdistinct as any, context);
    }

    if (node.aggfilter !== undefined) {
      result.aggfilter = this.transform(node.aggfilter as any, context);
    }

    if (node.aggstar !== undefined) {
      result.aggstar = node.aggstar;
    }

    if (node.aggvariadic !== undefined) {
      result.aggvariadic = node.aggvariadic;
    }

    if (node.aggkind !== undefined) {
      result.aggkind = node.aggkind;
    }

    if (node.agglevelsup !== undefined) {
      result.agglevelsup = node.agglevelsup;
    }

    if (node.aggsplit !== undefined) {
      result.aggsplit = node.aggsplit;
    }

    if (node.aggno !== undefined) {
      result.aggno = node.aggno;
    }

    if (node.aggtransno !== undefined) {
      result.aggtransno = node.aggtransno;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { Aggref: result };
  }

  WindowFunc(node: PG15.WindowFunc, context: TransformerContext): { WindowFunc: PG16.WindowFunc } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.winfnoid !== undefined) {
      result.winfnoid = node.winfnoid;
    }

    if (node.wintype !== undefined) {
      result.wintype = node.wintype;
    }

    if (node.wincollid !== undefined) {
      result.wincollid = node.wincollid;
    }

    if (node.inputcollid !== undefined) {
      result.inputcollid = node.inputcollid;
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.aggfilter !== undefined) {
      result.aggfilter = this.transform(node.aggfilter as any, context);
    }

    if (node.winref !== undefined) {
      result.winref = node.winref;
    }

    if (node.winstar !== undefined) {
      result.winstar = node.winstar;
    }

    if (node.winagg !== undefined) {
      result.winagg = node.winagg;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { WindowFunc: result };
  }

  FieldSelect(node: PG15.FieldSelect, context: TransformerContext): { FieldSelect: PG16.FieldSelect } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.fieldnum !== undefined) {
      result.fieldnum = node.fieldnum;
    }

    if (node.resulttype !== undefined) {
      result.resulttype = node.resulttype;
    }

    if (node.resulttypmod !== undefined) {
      result.resulttypmod = node.resulttypmod;
    }

    if (node.resultcollid !== undefined) {
      result.resultcollid = node.resultcollid;
    }

    return { FieldSelect: result };
  }

  RelabelType(node: PG15.RelabelType, context: TransformerContext): { RelabelType: PG16.RelabelType } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.resulttype !== undefined) {
      result.resulttype = node.resulttype;
    }

    if (node.resulttypmod !== undefined) {
      result.resulttypmod = node.resulttypmod;
    }

    if (node.resultcollid !== undefined) {
      result.resultcollid = node.resultcollid;
    }

    if (node.relabelformat !== undefined) {
      result.relabelformat = node.relabelformat;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { RelabelType: result };
  }

  CoerceViaIO(node: PG15.CoerceViaIO, context: TransformerContext): { CoerceViaIO: PG16.CoerceViaIO } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.resulttype !== undefined) {
      result.resulttype = node.resulttype;
    }

    if (node.resultcollid !== undefined) {
      result.resultcollid = node.resultcollid;
    }

    if (node.coerceformat !== undefined) {
      result.coerceformat = node.coerceformat;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { CoerceViaIO: result };
  }

  ArrayCoerceExpr(node: PG15.ArrayCoerceExpr, context: TransformerContext): { ArrayCoerceExpr: PG16.ArrayCoerceExpr } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.elemexpr !== undefined) {
      result.elemexpr = this.transform(node.elemexpr as any, context);
    }

    if (node.resulttype !== undefined) {
      result.resulttype = node.resulttype;
    }

    if (node.resulttypmod !== undefined) {
      result.resulttypmod = node.resulttypmod;
    }

    if (node.resultcollid !== undefined) {
      result.resultcollid = node.resultcollid;
    }

    if (node.coerceformat !== undefined) {
      result.coerceformat = node.coerceformat;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { ArrayCoerceExpr: result };
  }

  ConvertRowtypeExpr(node: PG15.ConvertRowtypeExpr, context: TransformerContext): { ConvertRowtypeExpr: PG16.ConvertRowtypeExpr } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.resulttype !== undefined) {
      result.resulttype = node.resulttype;
    }

    if (node.convertformat !== undefined) {
      result.convertformat = node.convertformat;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { ConvertRowtypeExpr: result };
  }

  NamedArgExpr(node: PG15.NamedArgExpr, context: TransformerContext): { NamedArgExpr: PG16.NamedArgExpr } {
    const result: any = {};

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.name !== undefined) {
      result.name = node.name;
    }

    if (node.argnumber !== undefined) {
      result.argnumber = node.argnumber;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { NamedArgExpr: result };
  }

  ViewStmt(node: PG15.ViewStmt, context: TransformerContext): { ViewStmt: PG16.ViewStmt } {
    const result: any = {};

    if (node.view !== undefined) {
      result.view = this.transform(node.view as any, context);
    }

    if (node.aliases !== undefined) {
      result.aliases = Array.isArray(node.aliases)
        ? node.aliases.map((item: any) => this.transform(item as any, context))
        : this.transform(node.aliases as any, context);
    }

    if (node.query !== undefined) {
      result.query = this.transform(node.query as any, context);
    }

    if (node.replace !== undefined) {
      result.replace = node.replace;
    }

    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map((item: any) => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }

    if (node.withCheckOption !== undefined) {
      result.withCheckOption = node.withCheckOption;
    }

    return { ViewStmt: result };
  }

  IndexStmt(node: PG15.IndexStmt, context: TransformerContext): { IndexStmt: PG16.IndexStmt } {
    const result: any = {};

    if (node.idxname !== undefined) {
      result.idxname = node.idxname;
    }

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }

    if (node.accessMethod !== undefined) {
      result.accessMethod = node.accessMethod;
    }

    if (node.tableSpace !== undefined) {
      result.tableSpace = node.tableSpace;
    }

    if (node.indexParams !== undefined) {
      result.indexParams = Array.isArray(node.indexParams)
        ? node.indexParams.map((item: any) => this.transform(item as any, context))
        : this.transform(node.indexParams as any, context);
    }

    if (node.indexIncludingParams !== undefined) {
      result.indexIncludingParams = Array.isArray(node.indexIncludingParams)
        ? node.indexIncludingParams.map((item: any) => this.transform(item as any, context))
        : this.transform(node.indexIncludingParams as any, context);
    }

    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map((item: any) => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }

    if (node.whereClause !== undefined) {
      result.whereClause = this.transform(node.whereClause as any, context);
    }

    if (node.excludeOpNames !== undefined) {
      result.excludeOpNames = Array.isArray(node.excludeOpNames)
        ? node.excludeOpNames.map((item: any) => this.transform(item as any, context))
        : this.transform(node.excludeOpNames as any, context);
    }

    if (node.idxcomment !== undefined) {
      result.idxcomment = node.idxcomment;
    }

    if (node.indexOid !== undefined) {
      result.indexOid = node.indexOid;
    }

    if (node.oldNode !== undefined) {
      result.oldNode = node.oldNode;
    }

    if (node.oldCreateSubid !== undefined) {
      result.oldCreateSubid = node.oldCreateSubid;
    }

    if (node.oldFirstRelfilenodeSubid !== undefined) {
      result.oldFirstRelfilenodeSubid = node.oldFirstRelfilenodeSubid;
    }

    if (node.unique !== undefined) {
      result.unique = node.unique;
    }

    if (node.nulls_not_distinct !== undefined) {
      result.nulls_not_distinct = node.nulls_not_distinct;
    }

    if (node.primary !== undefined) {
      result.primary = node.primary;
    }

    if (node.isconstraint !== undefined) {
      result.isconstraint = node.isconstraint;
    }

    if (node.deferrable !== undefined) {
      result.deferrable = node.deferrable;
    }

    if (node.initdeferred !== undefined) {
      result.initdeferred = node.initdeferred;
    }

    if (node.transformed !== undefined) {
      result.transformed = node.transformed;
    }

    if (node.concurrent !== undefined) {
      result.concurrent = node.concurrent;
    }

    if (node.if_not_exists !== undefined) {
      result.if_not_exists = node.if_not_exists;
    }

    if (node.reset_default_tblspc !== undefined) {
      result.reset_default_tblspc = node.reset_default_tblspc;
    }

    return { IndexStmt: result };
  }

  IndexElem(node: PG15.IndexElem, context: TransformerContext): { IndexElem: PG16.IndexElem } {
    const result: any = {};

    if (node.name !== undefined) {
      result.name = node.name;
    }

    if (node.expr !== undefined) {
      result.expr = this.transform(node.expr as any, context);
    }

    if (node.indexcolname !== undefined) {
      result.indexcolname = node.indexcolname;
    }

    if (node.collation !== undefined) {
      result.collation = Array.isArray(node.collation)
        ? node.collation.map((item: any) => this.transform(item as any, context))
        : this.transform(node.collation as any, context);
    }

    if (node.opclass !== undefined) {
      result.opclass = Array.isArray(node.opclass)
        ? node.opclass.map((item: any) => this.transform(item as any, context))
        : this.transform(node.opclass as any, context);
    }

    if (node.opclassopts !== undefined) {
      result.opclassopts = Array.isArray(node.opclassopts)
        ? node.opclassopts.map((item: any) => this.transform(item as any, context))
        : this.transform(node.opclassopts as any, context);
    }

    if (node.ordering !== undefined) {
      result.ordering = node.ordering;
    }

    if (node.nulls_ordering !== undefined) {
      result.nulls_ordering = node.nulls_ordering;
    }

    return { IndexElem: result };
  }

  PartitionElem(node: PG15.PartitionElem, context: TransformerContext): { PartitionElem: PG16.PartitionElem } {
    const result: any = {};

    if (node.name !== undefined) {
      result.name = node.name;
    }

    if (node.expr !== undefined) {
      result.expr = this.transform(node.expr as any, context);
    }

    if (node.collation !== undefined) {
      result.collation = Array.isArray(node.collation)
        ? node.collation.map((item: any) => this.transform(item as any, context))
        : this.transform(node.collation as any, context);
    }

    if (node.opclass !== undefined) {
      result.opclass = Array.isArray(node.opclass)
        ? node.opclass.map((item: any) => this.transform(item as any, context))
        : this.transform(node.opclass as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { PartitionElem: result };
  }

  PartitionCmd(node: PG15.PartitionCmd, context: TransformerContext): { PartitionCmd: PG16.PartitionCmd } {
    const result: any = {};

    if (node.name !== undefined) {
      result.name = this.transform(node.name as any, context);
    }

    if (node.bound !== undefined) {
      result.bound = this.transform(node.bound as any, context);
    }

    if (node.concurrent !== undefined) {
      result.concurrent = node.concurrent;
    }

    return { PartitionCmd: result };
  }


  JoinExpr(node: PG15.JoinExpr, context: TransformerContext): { JoinExpr: PG16.JoinExpr } {
    const result: any = {};

    if (node.jointype !== undefined) {
      result.jointype = node.jointype;
    }

    if (node.isNatural !== undefined) {
      result.isNatural = node.isNatural;
    }

    if (node.larg !== undefined) {
      result.larg = this.transform(node.larg as any, context);
    }

    if (node.rarg !== undefined) {
      result.rarg = this.transform(node.rarg as any, context);
    }

    if (node.usingClause !== undefined) {
      result.usingClause = Array.isArray(node.usingClause)
        ? node.usingClause.map((item: any) => this.transform(item as any, context))
        : this.transform(node.usingClause as any, context);
    }

    if (node.join_using_alias !== undefined) {
      result.join_using_alias = this.transform(node.join_using_alias as any, context);
    }

    if (node.quals !== undefined) {
      result.quals = this.transform(node.quals as any, context);
    }

    if (node.alias !== undefined) {
      result.alias = this.transform(node.alias as any, context);
    }

    if (node.rtindex !== undefined) {
      result.rtindex = node.rtindex;
    }

    return { JoinExpr: result };
  }

  FromExpr(node: PG15.FromExpr, context: TransformerContext): { FromExpr: PG16.FromExpr } {
    const result: any = {};

    if (node.fromlist !== undefined) {
      result.fromlist = Array.isArray(node.fromlist)
        ? node.fromlist.map((item: any) => this.transform(item as any, context))
        : this.transform(node.fromlist as any, context);
    }

    if (node.quals !== undefined) {
      result.quals = this.transform(node.quals as any, context);
    }

    return { FromExpr: result };
  }

  TransactionStmt(node: PG15.TransactionStmt, context: TransformerContext): { TransactionStmt: PG16.TransactionStmt } {
    const result: any = {};

    if (node.kind !== undefined) {
      result.kind = node.kind;
    }

    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map((item: any) => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }

    if (node.savepoint_name !== undefined) {
      result.savepoint_name = node.savepoint_name;
    }

    if (node.gid !== undefined) {
      result.gid = node.gid;
    }

    if (node.chain !== undefined) {
      result.chain = node.chain;
    }

    return { TransactionStmt: result };
  }

  VariableSetStmt(node: PG15.VariableSetStmt, context: TransformerContext): { VariableSetStmt: PG16.VariableSetStmt } {
    const result: any = {};

    if (node.kind !== undefined) {
      result.kind = node.kind;
    }

    if (node.name !== undefined) {
      result.name = node.name;
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.is_local !== undefined) {
      result.is_local = node.is_local;
    }

    return { VariableSetStmt: result };
  }

  VariableShowStmt(node: PG15.VariableShowStmt, context: TransformerContext): { VariableShowStmt: PG16.VariableShowStmt } {
    const result: any = {};

    if (node.name !== undefined) {
      result.name = node.name;
    }

    return { VariableShowStmt: result };
  }

  CreateSchemaStmt(node: PG15.CreateSchemaStmt, context: TransformerContext): { CreateSchemaStmt: PG16.CreateSchemaStmt } {
    const result: any = {};

    if (node.schemaname !== undefined) {
      result.schemaname = node.schemaname;
    }

    if (node.authrole !== undefined) {
      result.authrole = this.transform(node.authrole as any, context);
    }

    if (node.schemaElts !== undefined) {
      result.schemaElts = Array.isArray(node.schemaElts)
        ? node.schemaElts.map((item: any) => this.transform(item as any, context))
        : this.transform(node.schemaElts as any, context);
    }

    if (node.if_not_exists !== undefined) {
      result.if_not_exists = node.if_not_exists;
    }

    return { CreateSchemaStmt: result };
  }

  RoleSpec(node: PG15.RoleSpec, context: TransformerContext): { RoleSpec: PG16.RoleSpec } {
    const result: any = {};

    if (node.roletype !== undefined) {
      result.roletype = node.roletype;
    }

    if (node.rolename !== undefined) {
      result.rolename = node.rolename;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { RoleSpec: result };
  }

  DropStmt(node: PG15.DropStmt, context: TransformerContext): { DropStmt: PG16.DropStmt } {
    const result: any = {};

    if (node.objects !== undefined) {
      result.objects = Array.isArray(node.objects)
        ? node.objects.map((item: any) => this.transform(item as any, context))
        : this.transform(node.objects as any, context);
    }

    if (node.removeType !== undefined) {
      result.removeType = node.removeType;
    }

    if (node.behavior !== undefined) {
      result.behavior = node.behavior;
    }

    if (node.missing_ok !== undefined) {
      result.missing_ok = node.missing_ok;
    }

    if (node.concurrent !== undefined) {
      result.concurrent = node.concurrent;
    }

    return { DropStmt: result };
  }

  TruncateStmt(node: PG15.TruncateStmt, context: TransformerContext): { TruncateStmt: PG16.TruncateStmt } {
    const result: any = {};

    if (node.relations !== undefined) {
      result.relations = Array.isArray(node.relations)
        ? node.relations.map((item: any) => this.transform(item as any, context))
        : this.transform(node.relations as any, context);
    }

    if (node.restart_seqs !== undefined) {
      result.restart_seqs = node.restart_seqs;
    }

    if (node.behavior !== undefined) {
      result.behavior = node.behavior;
    }

    return { TruncateStmt: result };
  }

  ReturnStmt(node: PG15.ReturnStmt, context: TransformerContext): { ReturnStmt: PG16.ReturnStmt } {
    const result: any = {};

    if (node.returnval !== undefined) {
      result.returnval = this.transform(node.returnval as any, context);
    }

    return { ReturnStmt: result };
  }

  PLAssignStmt(node: PG15.PLAssignStmt, context: TransformerContext): { PLAssignStmt: PG16.PLAssignStmt } {
    const result: any = {};

    if (node.name !== undefined) {
      result.name = node.name;
    }

    if (node.indirection !== undefined) {
      result.indirection = Array.isArray(node.indirection)
        ? node.indirection.map((item: any) => this.transform(item as any, context))
        : this.transform(node.indirection as any, context);
    }

    if (node.nnames !== undefined) {
      result.nnames = node.nnames;
    }

    if (node.val !== undefined) {
      result.val = this.transform(node.val as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { PLAssignStmt: result };
  }

  CopyStmt(node: PG15.CopyStmt, context: TransformerContext): { CopyStmt: PG16.CopyStmt } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }

    if (node.query !== undefined) {
      result.query = this.transform(node.query as any, context);
    }

    if (node.attlist !== undefined) {
      result.attlist = Array.isArray(node.attlist)
        ? node.attlist.map((item: any) => this.transform(item as any, context))
        : this.transform(node.attlist as any, context);
    }

    if (node.is_from !== undefined) {
      result.is_from = node.is_from;
    }

    if (node.is_program !== undefined) {
      result.is_program = node.is_program;
    }

    if (node.filename !== undefined) {
      result.filename = node.filename;
    }

    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map((item: any) => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }

    if (node.whereClause !== undefined) {
      result.whereClause = this.transform(node.whereClause as any, context);
    }

    return { CopyStmt: result };
  }

  AlterTableStmt(node: PG15.AlterTableStmt, context: TransformerContext): { AlterTableStmt: PG16.AlterTableStmt } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }

    if (node.cmds !== undefined) {
      result.cmds = Array.isArray(node.cmds)
        ? node.cmds.map((item: any) => this.transform(item as any, context))
        : this.transform(node.cmds as any, context);
    }

    if (node.objtype !== undefined) {
      result.objtype = node.objtype;
    }

    if (node.missing_ok !== undefined) {
      result.missing_ok = node.missing_ok;
    }

    return { AlterTableStmt: result };
  }

  AlterTableCmd(node: PG15.AlterTableCmd, context: TransformerContext): { AlterTableCmd: PG16.AlterTableCmd } {
    const result: any = {};

    if (node.subtype !== undefined) {
      result.subtype = node.subtype;
    }

    if (node.name !== undefined) {
      result.name = node.name;
    }

    if (node.num !== undefined) {
      result.num = node.num;
    }

    if (node.newowner !== undefined) {
      result.newowner = this.transform(node.newowner as any, context);
    }

    if (node.def !== undefined) {
      result.def = this.transform(node.def as any, context);
    }

    if (node.behavior !== undefined) {
      result.behavior = node.behavior;
    }

    if (node.missing_ok !== undefined) {
      result.missing_ok = node.missing_ok;
    }

    return { AlterTableCmd: result };
  }

  CreateFunctionStmt(node: PG15.CreateFunctionStmt, context: TransformerContext): { CreateFunctionStmt: PG16.CreateFunctionStmt } {
    const result: any = {};

    if (node.is_procedure !== undefined) {
      result.is_procedure = node.is_procedure;
    }

    if (node.replace !== undefined) {
      result.replace = node.replace;
    }

    if (node.funcname !== undefined) {
      result.funcname = Array.isArray(node.funcname)
        ? node.funcname.map((item: any) => this.transform(item as any, context))
        : this.transform(node.funcname as any, context);
    }

    if (node.parameters !== undefined) {
      result.parameters = Array.isArray(node.parameters)
        ? node.parameters.map((item: any) => this.transform(item as any, context))
        : this.transform(node.parameters as any, context);
    }

    if (node.returnType !== undefined) {
      result.returnType = this.transform(node.returnType as any, context);
    }

    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map((item: any) => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }

    if (node.sql_body !== undefined) {
      result.sql_body = this.transform(node.sql_body as any, context);
    }

    return { CreateFunctionStmt: result };
  }

  FunctionParameter(node: PG15.FunctionParameter, context: TransformerContext): { FunctionParameter: PG16.FunctionParameter } {
    const result: any = {};

    if (node.name !== undefined) {
      result.name = node.name;
    }

    if (node.argType !== undefined) {
      result.argType = this.transform(node.argType as any, context);
    }

    if (node.mode !== undefined) {
      result.mode = node.mode;
    }

    if (node.defexpr !== undefined) {
      result.defexpr = this.transform(node.defexpr as any, context);
    }

    return { FunctionParameter: result };
  }

  CompositeTypeStmt(node: PG15.CompositeTypeStmt, context: TransformerContext): { CompositeTypeStmt: PG16.CompositeTypeStmt } {
    const result: any = {};

    if (node.typevar !== undefined) {
      result.typevar = this.transform(node.typevar as any, context);
    }

    if (node.coldeflist !== undefined) {
      result.coldeflist = Array.isArray(node.coldeflist)
        ? node.coldeflist.map((item: any) => this.transform(item as any, context))
        : this.transform(node.coldeflist as any, context);
    }

    return { CompositeTypeStmt: result };
  }

  DoStmt(node: PG15.DoStmt, context: TransformerContext): { DoStmt: PG16.DoStmt } {
    const result: any = {};

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    return { DoStmt: result };
  }

  DefineStmt(node: PG15.DefineStmt, context: TransformerContext): { DefineStmt: PG16.DefineStmt } {
    const result: any = {};

    if (node.kind !== undefined) {
      result.kind = node.kind;
    }

    if (node.oldstyle !== undefined) {
      result.oldstyle = node.oldstyle;
    }

    if (node.defnames !== undefined) {
      result.defnames = Array.isArray(node.defnames)
        ? node.defnames.map((item: any) => this.transform(item as any, context))
        : this.transform(node.defnames as any, context);
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.definition !== undefined) {
      result.definition = Array.isArray(node.definition)
        ? node.definition.map((item: any) => this.transform(item as any, context))
        : this.transform(node.definition as any, context);
    }

    if (node.if_not_exists !== undefined) {
      result.if_not_exists = node.if_not_exists;
    }

    if (node.replace !== undefined) {
      result.replace = node.replace;
    }

    return { DefineStmt: result };
  }

  RangeSubselect(node: PG15.RangeSubselect, context: TransformerContext): { RangeSubselect: PG16.RangeSubselect } {
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

  CreateEnumStmt(node: PG15.CreateEnumStmt, context: TransformerContext): { CreateEnumStmt: PG16.CreateEnumStmt } {
    const result: any = {};

    if (node.typeName !== undefined) {
      result.typeName = Array.isArray(node.typeName)
        ? node.typeName.map((item: any) => this.transform(item as any, context))
        : this.transform(node.typeName as any, context);
    }

    if (node.vals !== undefined) {
      result.vals = Array.isArray(node.vals)
        ? node.vals.map((item: any) => this.transform(item as any, context))
        : this.transform(node.vals as any, context);
    }

    return { CreateEnumStmt: result };
  }

  CreateDomainStmt(node: PG15.CreateDomainStmt, context: TransformerContext): { CreateDomainStmt: PG16.CreateDomainStmt } {
    const result: any = {};

    if (node.domainname !== undefined) {
      result.domainname = Array.isArray(node.domainname)
        ? node.domainname.map((item: any) => this.transform(item as any, context))
        : this.transform(node.domainname as any, context);
    }

    if (node.typeName !== undefined) {
      result.typeName = this.transform(node.typeName as any, context);
    }

    if (node.collClause !== undefined) {
      result.collClause = this.transform(node.collClause as any, context);
    }

    if (node.constraints !== undefined) {
      result.constraints = Array.isArray(node.constraints)
        ? node.constraints.map((item: any) => this.transform(item as any, context))
        : this.transform(node.constraints as any, context);
    }

    return { CreateDomainStmt: result };
  }

  CreateRoleStmt(node: PG15.CreateRoleStmt, context: TransformerContext): { CreateRoleStmt: PG16.CreateRoleStmt } {
    const result: any = {};

    if (node.stmt_type !== undefined) {
      result.stmt_type = node.stmt_type;
    }

    if (node.role !== undefined) {
      result.role = node.role;
    }

    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map((item: any) => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }

    return { CreateRoleStmt: result };
  }

  DefElem(node: PG15.DefElem, context: TransformerContext): { DefElem: PG16.DefElem } {
    const result: any = {};

    if (node.defnamespace !== undefined) {
      result.defnamespace = node.defnamespace;
    }

    if (node.defname !== undefined) {
      result.defname = node.defname;
    }

    if (node.arg !== undefined) {
      result.arg = this.transform(node.arg as any, context);
    }

    if (node.defaction !== undefined) {
      result.defaction = node.defaction;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { DefElem: result };
  }

  CreateTableSpaceStmt(node: PG15.CreateTableSpaceStmt, context: TransformerContext): { CreateTableSpaceStmt: PG16.CreateTableSpaceStmt } {
    const result: any = {};

    if (node.tablespacename !== undefined) {
      result.tablespacename = node.tablespacename;
    }

    if (node.owner !== undefined) {
      result.owner = this.transform(node.owner as any, context);
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map((item: any) => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }

    return { CreateTableSpaceStmt: result };
  }

  DropTableSpaceStmt(node: PG15.DropTableSpaceStmt, context: TransformerContext): { DropTableSpaceStmt: PG16.DropTableSpaceStmt } {
    const result: any = {};

    if (node.tablespacename !== undefined) {
      result.tablespacename = node.tablespacename;
    }

    if (node.missing_ok !== undefined) {
      result.missing_ok = node.missing_ok;
    }

    return { DropTableSpaceStmt: result };
  }

  AlterTableSpaceOptionsStmt(node: PG15.AlterTableSpaceOptionsStmt, context: TransformerContext): { AlterTableSpaceOptionsStmt: PG16.AlterTableSpaceOptionsStmt } {
    const result: any = {};

    if (node.tablespacename !== undefined) {
      result.tablespacename = node.tablespacename;
    }

    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map((item: any) => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }

    if (node.isReset !== undefined) {
      result.isReset = node.isReset;
    }

    return { AlterTableSpaceOptionsStmt: result };
  }

  CreateExtensionStmt(node: PG15.CreateExtensionStmt, context: TransformerContext): { CreateExtensionStmt: PG16.CreateExtensionStmt } {
    const result: any = {};

    if (node.extname !== undefined) {
      result.extname = node.extname;
    }

    if (node.if_not_exists !== undefined) {
      result.if_not_exists = node.if_not_exists;
    }

    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map((item: any) => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }

    return { CreateExtensionStmt: result };
  }

  AlterExtensionStmt(node: PG15.AlterExtensionStmt, context: TransformerContext): { AlterExtensionStmt: PG16.AlterExtensionStmt } {
    const result: any = {};

    if (node.extname !== undefined) {
      result.extname = node.extname;
    }

    if (node.options !== undefined) {
      result.options = Array.isArray(node.options)
        ? node.options.map((item: any) => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }

    return { AlterExtensionStmt: result };
  }

  CreateFdwStmt(node: PG15.CreateFdwStmt, context: TransformerContext): { CreateFdwStmt: PG16.CreateFdwStmt } {
    const result: any = { ...node };
    return { CreateFdwStmt: result };
  }

  SetOperationStmt(node: PG15.SetOperationStmt, context: TransformerContext): { SetOperationStmt: PG16.SetOperationStmt } {
    const result: any = { ...node };
    return { SetOperationStmt: result };
  }

  ReplicaIdentityStmt(node: PG15.ReplicaIdentityStmt, context: TransformerContext): { ReplicaIdentityStmt: PG16.ReplicaIdentityStmt } {
    const result: any = { ...node };
    return { ReplicaIdentityStmt: result };
  }

  AlterCollationStmt(node: PG15.AlterCollationStmt, context: TransformerContext): { AlterCollationStmt: PG16.AlterCollationStmt } {
    const result: any = { ...node };
    return { AlterCollationStmt: result };
  }

  AlterDomainStmt(node: PG15.AlterDomainStmt, context: TransformerContext): { AlterDomainStmt: PG16.AlterDomainStmt } {
    const result: any = { ...node };
    return { AlterDomainStmt: result };
  }

  PrepareStmt(node: PG15.PrepareStmt, context: TransformerContext): { PrepareStmt: PG16.PrepareStmt } {
    const result: any = { ...node };
    return { PrepareStmt: result };
  }

  ExecuteStmt(node: PG15.ExecuteStmt, context: TransformerContext): { ExecuteStmt: PG16.ExecuteStmt } {
    const result: any = { ...node };
    return { ExecuteStmt: result };
  }

  DeallocateStmt(node: PG15.DeallocateStmt, context: TransformerContext): { DeallocateStmt: PG16.DeallocateStmt } {
    const result: any = { ...node };
    return { DeallocateStmt: result };
  }

  NotifyStmt(node: PG15.NotifyStmt, context: TransformerContext): { NotifyStmt: PG16.NotifyStmt } {
    const result: any = { ...node };
    return { NotifyStmt: result };
  }

  ListenStmt(node: PG15.ListenStmt, context: TransformerContext): { ListenStmt: PG16.ListenStmt } {
    const result: any = { ...node };
    return { ListenStmt: result };
  }

  UnlistenStmt(node: PG15.UnlistenStmt, context: TransformerContext): { UnlistenStmt: PG16.UnlistenStmt } {
    const result: any = { ...node };
    return { UnlistenStmt: result };
  }

  CheckPointStmt(node: PG15.CheckPointStmt, context: TransformerContext): { CheckPointStmt: PG16.CheckPointStmt } {
    const result: any = { ...node };
    return { CheckPointStmt: result };
  }

  LoadStmt(node: PG15.LoadStmt, context: TransformerContext): { LoadStmt: PG16.LoadStmt } {
    const result: any = { ...node };
    return { LoadStmt: result };
  }

  DiscardStmt(node: PG15.DiscardStmt, context: TransformerContext): { DiscardStmt: PG16.DiscardStmt } {
    const result: any = { ...node };
    return { DiscardStmt: result };
  }

  CommentStmt(node: PG15.CommentStmt, context: TransformerContext): { CommentStmt: PG16.CommentStmt } {
    const result: any = {};

    if (node.objtype !== undefined) {
      result.objtype = node.objtype;
    }

    if (node.object !== undefined) {
      result.object = this.transform(node.object as any, context);
    }

    if (node.comment !== undefined) {
      result.comment = node.comment;
    }

    return { CommentStmt: result };
  }

  LockStmt(node: PG15.LockStmt, context: TransformerContext): { LockStmt: PG16.LockStmt } {
    const result: any = { ...node };
    return { LockStmt: result };
  }

  CreatePolicyStmt(node: PG15.CreatePolicyStmt, context: TransformerContext): { CreatePolicyStmt: PG16.CreatePolicyStmt } {
    const result: any = { ...node };
    return { CreatePolicyStmt: result };
  }

  AlterPolicyStmt(node: PG15.AlterPolicyStmt, context: TransformerContext): { AlterPolicyStmt: PG16.AlterPolicyStmt } {
    const result: any = { ...node };
    return { AlterPolicyStmt: result };
  }

  CreateUserMappingStmt(node: PG15.CreateUserMappingStmt, context: TransformerContext): { CreateUserMappingStmt: PG16.CreateUserMappingStmt } {
    const result: any = { ...node };
    return { CreateUserMappingStmt: result };
  }

  CreateStatsStmt(node: PG15.CreateStatsStmt, context: TransformerContext): { CreateStatsStmt: PG16.CreateStatsStmt } {
    const result: any = { ...node };
    return { CreateStatsStmt: result };
  }

  StatsElem(node: PG15.StatsElem, context: TransformerContext): { StatsElem: PG16.StatsElem } {
    const result: any = { ...node };
    return { StatsElem: result };
  }

  CreatePublicationStmt(node: PG15.CreatePublicationStmt, context: TransformerContext): { CreatePublicationStmt: PG16.CreatePublicationStmt } {
    const result: any = { ...node };
    return { CreatePublicationStmt: result };
  }

  CreateSubscriptionStmt(node: PG15.CreateSubscriptionStmt, context: TransformerContext): { CreateSubscriptionStmt: PG16.CreateSubscriptionStmt } {
    const result: any = { ...node };
    return { CreateSubscriptionStmt: result };
  }

  AlterPublicationStmt(node: PG15.AlterPublicationStmt, context: TransformerContext): { AlterPublicationStmt: PG16.AlterPublicationStmt } {
    const result: any = { ...node };
    return { AlterPublicationStmt: result };
  }

  AlterSubscriptionStmt(node: PG15.AlterSubscriptionStmt, context: TransformerContext): { AlterSubscriptionStmt: PG16.AlterSubscriptionStmt } {
    const result: any = { ...node };
    return { AlterSubscriptionStmt: result };
  }

  DropSubscriptionStmt(node: PG15.DropSubscriptionStmt, context: TransformerContext): { DropSubscriptionStmt: PG16.DropSubscriptionStmt } {
    const result: any = { ...node };
    return { DropSubscriptionStmt: result };
  }

  InlineCodeBlock(node: PG15.InlineCodeBlock, context: TransformerContext): { InlineCodeBlock: PG16.InlineCodeBlock } {
    const result: any = { ...node };
    return { InlineCodeBlock: result };
  }

  CallContext(node: PG15.CallContext, context: TransformerContext): { CallContext: PG16.CallContext } {
    const result: any = { ...node };
    return { CallContext: result };
  }

  ConstraintsSetStmt(node: PG15.ConstraintsSetStmt, context: TransformerContext): { ConstraintsSetStmt: PG16.ConstraintsSetStmt } {
    const result: any = { ...node };
    return { ConstraintsSetStmt: result };
  }

  AlterSystemStmt(node: PG15.AlterSystemStmt, context: TransformerContext): { AlterSystemStmt: PG16.AlterSystemStmt } {
    const result: any = { ...node };
    return { AlterSystemStmt: result };
  }

  VacuumRelation(node: PG15.VacuumRelation, context: TransformerContext): { VacuumRelation: PG16.VacuumRelation } {
    const result: any = { ...node };
    return { VacuumRelation: result };
  }

  DropOwnedStmt(node: PG15.DropOwnedStmt, context: TransformerContext): { DropOwnedStmt: PG16.DropOwnedStmt } {
    const result: any = { ...node };
    return { DropOwnedStmt: result };
  }

  ReassignOwnedStmt(node: PG15.ReassignOwnedStmt, context: TransformerContext): { ReassignOwnedStmt: PG16.ReassignOwnedStmt } {
    const result: any = { ...node };
    return { ReassignOwnedStmt: result };
  }

  AlterTSDictionaryStmt(node: PG15.AlterTSDictionaryStmt, context: TransformerContext): { AlterTSDictionaryStmt: PG16.AlterTSDictionaryStmt } {
    const result: any = { ...node };
    return { AlterTSDictionaryStmt: result };
  }

  AlterTSConfigurationStmt(node: PG15.AlterTSConfigurationStmt, context: TransformerContext): { AlterTSConfigurationStmt: PG16.AlterTSConfigurationStmt } {
    const result: any = { ...node };
    return { AlterTSConfigurationStmt: result };
  }

  ClosePortalStmt(node: PG15.ClosePortalStmt, context: TransformerContext): { ClosePortalStmt: PG16.ClosePortalStmt } {
    const result: any = { ...node };
    return { ClosePortalStmt: result };
  }

  FetchStmt(node: PG15.FetchStmt, context: TransformerContext): { FetchStmt: PG16.FetchStmt } {
    const result: any = { ...node };
    return { FetchStmt: result };
  }

  AlterStatsStmt(node: PG15.AlterStatsStmt, context: TransformerContext): { AlterStatsStmt: PG16.AlterStatsStmt } {
    const result: any = { ...node };
    return { AlterStatsStmt: result };
  }

  ObjectWithArgs(node: PG15.ObjectWithArgs, context: TransformerContext): { ObjectWithArgs: PG16.ObjectWithArgs } {
    const result: any = { ...node };
    return { ObjectWithArgs: result };
  }

  AlterOperatorStmt(node: PG15.AlterOperatorStmt, context: TransformerContext): { AlterOperatorStmt: PG16.AlterOperatorStmt } {
    const result: any = { ...node };
    return { AlterOperatorStmt: result };
  }

  AlterFdwStmt(node: PG15.AlterFdwStmt, context: TransformerContext): { AlterFdwStmt: PG16.AlterFdwStmt } {
    const result: any = { ...node };
    return { AlterFdwStmt: result };
  }

  CreateForeignServerStmt(node: PG15.CreateForeignServerStmt, context: TransformerContext): { CreateForeignServerStmt: PG16.CreateForeignServerStmt } {
    const result: any = { ...node };
    return { CreateForeignServerStmt: result };
  }

  AlterForeignServerStmt(node: PG15.AlterForeignServerStmt, context: TransformerContext): { AlterForeignServerStmt: PG16.AlterForeignServerStmt } {
    const result: any = { ...node };
    return { AlterForeignServerStmt: result };
  }

  AlterUserMappingStmt(node: PG15.AlterUserMappingStmt, context: TransformerContext): { AlterUserMappingStmt: PG16.AlterUserMappingStmt } {
    const result: any = { ...node };
    return { AlterUserMappingStmt: result };
  }

  DropUserMappingStmt(node: PG15.DropUserMappingStmt, context: TransformerContext): { DropUserMappingStmt: PG16.DropUserMappingStmt } {
    const result: any = { ...node };
    return { DropUserMappingStmt: result };
  }

  ImportForeignSchemaStmt(node: PG15.ImportForeignSchemaStmt, context: TransformerContext): { ImportForeignSchemaStmt: PG16.ImportForeignSchemaStmt } {
    const result: any = { ...node };
    return { ImportForeignSchemaStmt: result };
  }

  ClusterStmt(node: PG15.ClusterStmt, context: TransformerContext): { ClusterStmt: PG16.ClusterStmt } {
    const result: any = { ...node };
    return { ClusterStmt: result };
  }

  VacuumStmt(node: PG15.VacuumStmt, context: TransformerContext): { VacuumStmt: PG16.VacuumStmt } {
    const result: any = { ...node };
    return { VacuumStmt: result };
  }

  ExplainStmt(node: PG15.ExplainStmt, context: TransformerContext): { ExplainStmt: PG16.ExplainStmt } {
    const result: any = { ...node };
    return { ExplainStmt: result };
  }

  ReindexStmt(node: PG15.ReindexStmt, context: TransformerContext): { ReindexStmt: PG16.ReindexStmt } {
    const result: any = { ...node };
    return { ReindexStmt: result };
  }

  CallStmt(node: PG15.CallStmt, context: TransformerContext): { CallStmt: PG16.CallStmt } {
    const result: any = { ...node };
    return { CallStmt: result };
  }

  CreatedbStmt(node: PG15.CreatedbStmt, context: TransformerContext): { CreatedbStmt: PG16.CreatedbStmt } {
    const result: any = { ...node };
    return { CreatedbStmt: result };
  }

  DropdbStmt(node: PG15.DropdbStmt, context: TransformerContext): { DropdbStmt: PG16.DropdbStmt } {
    const result: any = { ...node };
    return { DropdbStmt: result };
  }

  RenameStmt(node: PG15.RenameStmt, context: TransformerContext): { RenameStmt: PG16.RenameStmt } {
    const result: any = { ...node };
    return { RenameStmt: result };
  }

  AlterOwnerStmt(node: PG15.AlterOwnerStmt, context: TransformerContext): { AlterOwnerStmt: PG16.AlterOwnerStmt } {
    const result: any = { ...node };
    return { AlterOwnerStmt: result };
  }


  GrantRoleStmt(node: PG15.GrantRoleStmt, context: TransformerContext): { GrantRoleStmt: PG16.GrantRoleStmt } {
    const result: any = {};

    if (node.granted_roles !== undefined) {
      result.granted_roles = Array.isArray(node.granted_roles)
        ? node.granted_roles.map((item: any) => this.transform(item as any, context))
        : this.transform(node.granted_roles as any, context);
    }

    if (node.grantee_roles !== undefined) {
      result.grantee_roles = Array.isArray(node.grantee_roles)
        ? node.grantee_roles.map((item: any) => this.transform(item as any, context))
        : this.transform(node.grantee_roles as any, context);
    }

    if (node.is_grant !== undefined) {
      result.is_grant = node.is_grant;
    }

    if (node.behavior !== undefined) {
      result.behavior = node.behavior;
    }

    const nodeAny = node as any;
    if (nodeAny.admin_opt === true) {
      result.opt = [
        {
          DefElem: {
            defname: "admin",
            arg: {
              Boolean: {
                boolval: true
              }
            },
            defaction: "DEFELEM_UNSPEC"
          }
        }
      ];
    } else if (nodeAny.opt !== undefined) {
      // Handle any existing opt field by transforming it
      result.opt = Array.isArray(nodeAny.opt)
        ? nodeAny.opt.map((item: any) => this.transform(item as any, context))
        : this.transform(nodeAny.opt as any, context);
    }

    return { GrantRoleStmt: result };
  }

  SecLabelStmt(node: PG15.SecLabelStmt, context: TransformerContext): { SecLabelStmt: PG16.SecLabelStmt } {
    const result: any = { ...node };
    return { SecLabelStmt: result };
  }

  AlterDefaultPrivilegesStmt(node: PG15.AlterDefaultPrivilegesStmt, context: TransformerContext): { AlterDefaultPrivilegesStmt: PG16.AlterDefaultPrivilegesStmt } {
    const result: any = { ...node };
    return { AlterDefaultPrivilegesStmt: result };
  }

  CreateConversionStmt(node: PG15.CreateConversionStmt, context: TransformerContext): { CreateConversionStmt: PG16.CreateConversionStmt } {
    const result: any = { ...node };
    return { CreateConversionStmt: result };
  }

  CreateCastStmt(node: PG15.CreateCastStmt, context: TransformerContext): { CreateCastStmt: PG16.CreateCastStmt } {
    const result: any = { ...node };
    return { CreateCastStmt: result };
  }

  CreatePLangStmt(node: PG15.CreatePLangStmt, context: TransformerContext): { CreatePLangStmt: PG16.CreatePLangStmt } {
    const result: any = { ...node };
    return { CreatePLangStmt: result };
  }

  CreateTransformStmt(node: PG15.CreateTransformStmt, context: TransformerContext): { CreateTransformStmt: PG16.CreateTransformStmt } {
    const result: any = { ...node };
    return { CreateTransformStmt: result };
  }

  CreateTrigStmt(node: PG15.CreateTrigStmt, context: TransformerContext): { CreateTrigStmt: PG16.CreateTrigStmt } {
    const result: any = { ...node };
    return { CreateTrigStmt: result };
  }

  TriggerTransition(node: PG15.TriggerTransition, context: TransformerContext): { TriggerTransition: PG16.TriggerTransition } {
    const result: any = { ...node };
    return { TriggerTransition: result };
  }

  CreateEventTrigStmt(node: PG15.CreateEventTrigStmt, context: TransformerContext): { CreateEventTrigStmt: PG16.CreateEventTrigStmt } {
    const result: any = { ...node };
    return { CreateEventTrigStmt: result };
  }

  AlterEventTrigStmt(node: PG15.AlterEventTrigStmt, context: TransformerContext): { AlterEventTrigStmt: PG16.AlterEventTrigStmt } {
    const result: any = { ...node };
    return { AlterEventTrigStmt: result };
  }

  CreateOpClassStmt(node: PG15.CreateOpClassStmt, context: TransformerContext): { CreateOpClassStmt: PG16.CreateOpClassStmt } {
    const result: any = { ...node };
    return { CreateOpClassStmt: result };
  }

  CreateOpFamilyStmt(node: PG15.CreateOpFamilyStmt, context: TransformerContext): { CreateOpFamilyStmt: PG16.CreateOpFamilyStmt } {
    const result: any = { ...node };
    return { CreateOpFamilyStmt: result };
  }

  AlterOpFamilyStmt(node: PG15.AlterOpFamilyStmt, context: TransformerContext): { AlterOpFamilyStmt: PG16.AlterOpFamilyStmt } {
    const result: any = { ...node };
    return { AlterOpFamilyStmt: result };
  }

  MergeStmt(node: PG15.MergeStmt, context: TransformerContext): { MergeStmt: PG16.MergeStmt } {
    const result: any = { ...node };
    return { MergeStmt: result };
  }

  AlterTableMoveAllStmt(node: PG15.AlterTableMoveAllStmt, context: TransformerContext): { AlterTableMoveAllStmt: PG16.AlterTableMoveAllStmt } {
    const result: any = { ...node };
    return { AlterTableMoveAllStmt: result };
  }

  CreateSeqStmt(node: PG15.CreateSeqStmt, context: TransformerContext): { CreateSeqStmt: PG16.CreateSeqStmt } {
    const result: any = { ...node };
    return { CreateSeqStmt: result };
  }

  AlterSeqStmt(node: PG15.AlterSeqStmt, context: TransformerContext): { AlterSeqStmt: PG16.AlterSeqStmt } {
    const result: any = { ...node };
    return { AlterSeqStmt: result };
  }

  CreateRangeStmt(node: PG15.CreateRangeStmt, context: TransformerContext): { CreateRangeStmt: PG16.CreateRangeStmt } {
    const result: any = {};

    if (node.typeName !== undefined) {
      result.typeName = Array.isArray(node.typeName)
        ? node.typeName.map((item: any) => this.transform(item as any, context))
        : this.transform(node.typeName as any, context);
    }

    if (node.params !== undefined) {
      result.params = Array.isArray(node.params)
        ? node.params.map((item: any) => this.transform(item as any, context))
        : this.transform(node.params as any, context);
    }

    return { CreateRangeStmt: result };
  }

  AlterEnumStmt(node: PG15.AlterEnumStmt, context: TransformerContext): { AlterEnumStmt: PG16.AlterEnumStmt } {
    const result: any = { ...node };
    return { AlterEnumStmt: result };
  }

  AlterTypeStmt(node: PG15.AlterTypeStmt, context: TransformerContext): { AlterTypeStmt: PG16.AlterTypeStmt } {
    const result: any = { ...node };
    return { AlterTypeStmt: result };
  }

  AlterRoleStmt(node: PG15.AlterRoleStmt, context: TransformerContext): { AlterRoleStmt: PG16.AlterRoleStmt } {
    const result: any = { ...node };
    return { AlterRoleStmt: result };
  }


  CreateTableAsStmt(node: PG15.CreateTableAsStmt, context: TransformerContext): { CreateTableAsStmt: PG16.CreateTableAsStmt } {
    const result: any = { ...node };
    return { CreateTableAsStmt: result };
  }

  RefreshMatViewStmt(node: PG15.RefreshMatViewStmt, context: TransformerContext): { RefreshMatViewStmt: PG16.RefreshMatViewStmt } {
    const result: any = { ...node };
    return { RefreshMatViewStmt: result };
  }

  AccessPriv(node: PG15.AccessPriv, context: TransformerContext): { AccessPriv: PG16.AccessPriv } {
    const result: any = { ...node };
    return { AccessPriv: result };
  }

  AlterDatabaseStmt(node: PG15.AlterDatabaseStmt, context: TransformerContext): { AlterDatabaseStmt: PG16.AlterDatabaseStmt } {
    const result: any = { ...node };
    return { AlterDatabaseStmt: result };
  }

  AlterDatabaseRefreshCollStmt(node: PG15.AlterDatabaseRefreshCollStmt, context: TransformerContext): { AlterDatabaseRefreshCollStmt: PG16.AlterDatabaseRefreshCollStmt } {
    const result: any = { ...node };
    return { AlterDatabaseRefreshCollStmt: result };
  }

  AlterDatabaseSetStmt(node: PG15.AlterDatabaseSetStmt, context: TransformerContext): { AlterDatabaseSetStmt: PG16.AlterDatabaseSetStmt } {
    const result: any = { ...node };
    return { AlterDatabaseSetStmt: result };
  }

  DeclareCursorStmt(node: PG15.DeclareCursorStmt, context: TransformerContext): { DeclareCursorStmt: PG16.DeclareCursorStmt } {
    const result: any = { ...node };
    return { DeclareCursorStmt: result };
  }

  PublicationObjSpec(node: PG15.PublicationObjSpec, context: TransformerContext): { PublicationObjSpec: PG16.PublicationObjSpec } {
    const result: any = { ...node };
    return { PublicationObjSpec: result };
  }

  PublicationTable(node: PG15.PublicationTable, context: TransformerContext): { PublicationTable: PG16.PublicationTable } {
    const result: any = { ...node };
    return { PublicationTable: result };
  }

  CreateAmStmt(node: PG15.CreateAmStmt, context: TransformerContext): { CreateAmStmt: PG16.CreateAmStmt } {
    const result: any = { ...node };
    return { CreateAmStmt: result };
  }

  IntoClause(node: PG15.IntoClause, context: TransformerContext): { IntoClause: PG16.IntoClause } {
    const result: any = { ...node };
    return { IntoClause: result };
  }

  OnConflictExpr(node: PG15.OnConflictExpr, context: TransformerContext): { OnConflictExpr: PG16.OnConflictExpr } {
    const result: any = { ...node };
    return { OnConflictExpr: result };
  }

  ScanToken(node: PG15.ScanToken, context: TransformerContext): { ScanToken: PG16.ScanToken } {
    const result: any = { ...node };
    return { ScanToken: result };
  }

  CreateOpClassItem(node: PG15.CreateOpClassItem, context: TransformerContext): { CreateOpClassItem: PG16.CreateOpClassItem } {
    const result: any = { ...node };
    return { CreateOpClassItem: result };
  }

  Var(node: PG15.Var, context: TransformerContext): { Var: PG16.Var } {
    const result: any = { ...node };
    return { Var: result };
  }

  TableFunc(node: PG15.TableFunc, context: TransformerContext): { TableFunc: PG16.TableFunc } {
    const result: any = { ...node };
    return { TableFunc: result };
  }

  RangeTableFunc(node: PG15.RangeTableFunc, context: TransformerContext): { RangeTableFunc: PG16.RangeTableFunc } {
    const result: any = { ...node };
    return { RangeTableFunc: result };
  }

  RangeTableFuncCol(node: PG15.RangeTableFuncCol, context: TransformerContext): { RangeTableFuncCol: PG16.RangeTableFuncCol } {
    const result: any = { ...node };
    return { RangeTableFuncCol: result };
  }

  RangeFunction(node: PG15.RangeFunction, context: TransformerContext): { RangeFunction: PG16.RangeFunction } {
    const result: any = { ...node };

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
        ? node.functions.map((item: any) => this.transform(item as any, context))
        : this.transform(node.functions as any, context);
    }

    if (node.alias !== undefined) {
      result.alias = this.transform(node.alias as any, context);
    }

    if (node.coldeflist !== undefined) {
      result.coldeflist = Array.isArray(node.coldeflist)
        ? node.coldeflist.map((item: any) => this.transform(item as any, context))
        : this.transform(node.coldeflist as any, context);
    }

    return { RangeFunction: result };
  }


  RangeTableSample(node: PG15.RangeTableSample, context: TransformerContext): { RangeTableSample: PG16.RangeTableSample } {
    const result: any = { ...node };

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }

    if (node.method !== undefined) {
      result.method = Array.isArray(node.method)
        ? node.method.map((item: any) => this.transform(item as any, context))
        : this.transform(node.method as any, context);
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.repeatable !== undefined) {
      result.repeatable = this.transform(node.repeatable as any, context);
    }

    return { RangeTableSample: result };
  }

  XmlSerialize(node: PG15.XmlSerialize, context: TransformerContext): { XmlSerialize: PG16.XmlSerialize } {
    const result: any = { ...node };

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

  RuleStmt(node: PG15.RuleStmt, context: TransformerContext): { RuleStmt: PG16.RuleStmt } {
    const result: any = { ...node };
    return { RuleStmt: result };
  }

  SQLValueFunction(node: PG15.SQLValueFunction, context: TransformerContext): { SQLValueFunction: PG16.SQLValueFunction } {
    const result: any = { ...node };
    return { SQLValueFunction: result };
  }

  GroupingFunc(node: PG15.GroupingFunc, context: TransformerContext): { GroupingFunc: PG16.GroupingFunc } {
    const result: any = { ...node };
    return { GroupingFunc: result };
  }

  MultiAssignRef(node: PG15.MultiAssignRef, context: TransformerContext): { MultiAssignRef: PG16.MultiAssignRef } {
    const result: any = { ...node };
    return { MultiAssignRef: result };
  }

  SetToDefault(node: PG15.SetToDefault, context: TransformerContext): { SetToDefault: PG16.SetToDefault } {
    const result: any = { ...node };
    return { SetToDefault: result };
  }

  CurrentOfExpr(node: PG15.CurrentOfExpr, context: TransformerContext): { CurrentOfExpr: PG16.CurrentOfExpr } {
    const result: any = { ...node };
    return { CurrentOfExpr: result };
  }

  TableLikeClause(node: PG15.TableLikeClause, context: TransformerContext): { TableLikeClause: PG16.TableLikeClause } {
    const result: any = { ...node };
    return { TableLikeClause: result };
  }

  AlterFunctionStmt(node: PG15.AlterFunctionStmt, context: TransformerContext): { AlterFunctionStmt: PG16.AlterFunctionStmt } {
    const result: any = { ...node };
    return { AlterFunctionStmt: result };
  }

  AlterObjectSchemaStmt(node: PG15.AlterObjectSchemaStmt, context: TransformerContext): { AlterObjectSchemaStmt: PG16.AlterObjectSchemaStmt } {
    const result: any = { ...node };
    return { AlterObjectSchemaStmt: result };
  }


  CreateForeignTableStmt(node: PG15.CreateForeignTableStmt, context: TransformerContext): { CreateForeignTableStmt: PG16.CreateForeignTableStmt } {
    const result: any = { ...node };
    return { CreateForeignTableStmt: result };
  }

  DropRoleStmt(node: PG15.DropRoleStmt, context: TransformerContext): { DropRoleStmt: PG16.DropRoleStmt } {
    const result: any = { ...node };

    if (node.missing_ok !== undefined) {
      result.missing_ok = node.missing_ok;
    }

    if (node.roles !== undefined) {
      result.roles = Array.isArray(node.roles)
        ? node.roles.map((item: any) => this.transform(item as any, context))
        : this.transform(node.roles as any, context);
    }

    return { DropRoleStmt: result };
  }

  XmlExpr(node: PG15.XmlExpr, context: TransformerContext): { XmlExpr: PG16.XmlExpr } {
    const result: any = { ...node };

    if (node.xpr !== undefined) {
      result.xpr = this.transform(node.xpr as any, context);
    }

    if (node.op !== undefined) {
      result.op = node.op;
    }

    if (node.name !== undefined) {
      result.name = node.name;
    }

    if (node.named_args !== undefined) {
      result.named_args = Array.isArray(node.named_args)
        ? node.named_args.map((item: any) => this.transform(item as any, context))
        : this.transform(node.named_args as any, context);
    }

    if (node.arg_names !== undefined) {
      result.arg_names = Array.isArray(node.arg_names)
        ? node.arg_names.map((item: any) => this.transform(item as any, context))
        : this.transform(node.arg_names as any, context);
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map((item: any) => this.transform(item as any, context))
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

  AlterRoleSetStmt(node: PG15.AlterRoleSetStmt, context: TransformerContext): { AlterRoleSetStmt: PG16.AlterRoleSetStmt } {
    const result: any = { ...node };

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

  GrantStmt(node: PG15.GrantStmt, context: TransformerContext): { GrantStmt: PG16.GrantStmt } {
    const result: any = { ...node };

    if (node.is_grant !== undefined) {
      result.is_grant = node.is_grant;
    }

    if (node.targtype !== undefined) {
      result.targtype = node.targtype;
    }

    if (node.objtype !== undefined) {
      result.objtype = node.objtype;
    }

    if (node.objects !== undefined) {
      result.objects = Array.isArray(node.objects)
        ? node.objects.map((item: any) => this.transform(item as any, context))
        : this.transform(node.objects as any, context);
    }

    if (node.privileges !== undefined) {
      result.privileges = Array.isArray(node.privileges)
        ? node.privileges.map((item: any) => this.transform(item as any, context))
        : this.transform(node.privileges as any, context);
    }

    if (node.grantees !== undefined) {
      result.grantees = Array.isArray(node.grantees)
        ? node.grantees.map((item: any) => this.transform(item as any, context))
        : this.transform(node.grantees as any, context);
    }

    if (node.grant_option !== undefined) {
      result.grant_option = node.grant_option;
    }

    if (node.behavior !== undefined) {
      result.behavior = node.behavior;
    }

    return { GrantStmt: result };
  }
}
