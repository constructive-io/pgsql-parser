import * as PG14 from '../14/types';
import * as PG15 from '../15/types';
import { TransformerContext } from './context';

/**
 * V14 to V15 AST Transformer
 * Transforms PostgreSQL v14 AST nodes to v15 format
 */
export class V14ToV15Transformer {
  
  transform(node: PG14.Node, context: TransformerContext = { parentNodeTypes: [] }): any {
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

  visit(node: PG14.Node, context: TransformerContext = { parentNodeTypes: [] }): any {
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
    
    // If no specific method, use transformGenericNode to handle nested transformations
    return this.transformGenericNode(node, context);
  }

  getNodeType(node: PG14.Node): any {
    return Object.keys(node)[0];
  }

  getNodeData(node: PG14.Node): any {
    const keys = Object.keys(node);
    if (keys.length === 1 && typeof (node as any)[keys[0]] === 'object') {
      return (node as any)[keys[0]];
    }
    return node;
  }

  private transformGenericNode(node: any, context: TransformerContext): any {
    if (typeof node !== 'object' || node === null) return node;
    if (Array.isArray(node)) return node.map(item => this.transform(item, context));

    const keys = Object.keys(node);
    if (keys.length === 1 && typeof node[keys[0]] === 'object' && node[keys[0]] !== null && !Array.isArray(node[keys[0]])) {
      const nodeType = keys[0];
      const nodeData = node[keys[0]];

      const transformedData: any = {};
      for (const [key, value] of Object.entries(nodeData)) {
        if (Array.isArray(value)) {
          if (key === 'arrayBounds') {
            transformedData[key] = value.map(item => {
              return this.transform(item as any, context);
            });
          } else {
            transformedData[key] = value.map(item => this.transform(item as any, context));
          }
        }else if (typeof value === 'object' && value !== null) {
          const keys = Object.keys(value);
          const isNumericKeysObject = keys.every(k => /^\d+$/.test(k));
          
          if (isNumericKeysObject && keys.length > 0) {
            const sortedKeys = keys.sort((a, b) => parseInt(a) - parseInt(b));
            transformedData[key] = sortedKeys.map(k => this.transform((value as any)[k], context));
          } else {
            // Regular object transformation
            transformedData[key] = this.transform(value as any, context);
          }
        } else {
          transformedData[key] = value;
        }
      }

      return { [nodeType]: transformedData };
    }

    const result: any = {};
    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value)) {
        if (key === 'arrayBounds') {
          result[key] = value.map(item => {
            return this.transform(item as any, context);
          });
        } else {
          result[key] = value.map(item => this.transform(item as any, context));
        }
      }else if (typeof value === 'object' && value !== null) {
        const keys = Object.keys(value);
        const isNumericKeysObject = keys.every(k => /^\d+$/.test(k));
        
        if (isNumericKeysObject && keys.length > 0) {
          const sortedKeys = keys.sort((a, b) => parseInt(a) - parseInt(b));
          result[key] = sortedKeys.map(k => this.transform((value as any)[k], context));
        } else {
          // Regular object transformation
          result[key] = this.transform(value as any, context);
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  ParseResult(node: PG14.ParseResult, context: TransformerContext): PG15.ParseResult {
    
    if (node && typeof node === 'object' && 'version' in node && 'stmts' in node) {
      return {
        version: 150000, // PG15 version
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

    return node as PG15.ParseResult;
  }

  RawStmt(node: PG14.RawStmt, context: TransformerContext): { RawStmt: PG15.RawStmt } {
    const result = this.transformGenericNode(node, context);
    return { RawStmt: result };
  }

  SelectStmt(node: PG14.SelectStmt, context: TransformerContext): { SelectStmt: PG15.SelectStmt } {
    const result = this.transformGenericNode(node, context);
    return { SelectStmt: result };
  }

  A_Expr(node: PG14.A_Expr, context: TransformerContext): { A_Expr: PG15.A_Expr } {
    const result = this.transformGenericNode(node, context);
    return { A_Expr: result };
  }

  InsertStmt(node: PG14.InsertStmt, context: TransformerContext): { InsertStmt: PG15.InsertStmt } {
    const result = this.transformGenericNode(node, context);
    return { InsertStmt: result };
  }

  UpdateStmt(node: PG14.UpdateStmt, context: TransformerContext): { UpdateStmt: PG15.UpdateStmt } {
    const result = this.transformGenericNode(node, context);
    return { UpdateStmt: result };
  }

  DeleteStmt(node: PG14.DeleteStmt, context: TransformerContext): { DeleteStmt: PG15.DeleteStmt } {
    const result = this.transformGenericNode(node, context);
    return { DeleteStmt: result };
  }

  WithClause(node: PG14.WithClause, context: TransformerContext): { WithClause: PG15.WithClause } {
    const result = this.transformGenericNode(node, context);
    return { WithClause: result };
  }

  ResTarget(node: PG14.ResTarget, context: TransformerContext): { ResTarget: PG15.ResTarget } {
    const result = this.transformGenericNode(node, context);
    return { ResTarget: result };
  }

  BoolExpr(node: PG14.BoolExpr, context: TransformerContext): { BoolExpr: PG15.BoolExpr } {
    const result = this.transformGenericNode(node, context);
    return { BoolExpr: result };
  }

  FuncCall(node: PG14.FuncCall, context: TransformerContext): { FuncCall: PG15.FuncCall } {
    const result = this.transformGenericNode(node, context);
    return { FuncCall: result };
  }

  FuncExpr(node: PG14.FuncExpr, context: TransformerContext): { FuncExpr: PG15.FuncExpr } {
    const result = this.transformGenericNode(node, context);
    return { FuncExpr: result };
  }

  A_Const(node: PG14.A_Const, context: TransformerContext): { A_Const: PG15.A_Const } {
    const result: any = {};
    
    for (const [key, value] of Object.entries(node)) {
      result[key] = value;
    }
    
    if (result.val) {
      const val: any = result.val;
      if (val.String && val.String.str !== undefined) {
        result.sval = { sval: val.String.str };
        delete result.val;
      } else if (val.Integer !== undefined) {
        if (val.Integer.ival !== undefined) {
          if (val.Integer.ival === 0) {
            result.ival = {};
          } else {
            result.ival = { ival: val.Integer.ival };
          }
        } else {
          result.ival = {};
        }
        delete result.val;
      } else if (val.Float && val.Float.str !== undefined) {
        result.fval = { fval: val.Float.str };
        delete result.val;
      } else if (val.BitString && val.BitString.str !== undefined) {
        result.bsval = { bsval: val.BitString.str };
        delete result.val;
      } else if (val.Null !== undefined) {
        result.isnull = true;
        delete result.val;
      }
    }
    
    // Handle ival field directly (not nested in val) - removed overly broad conversion
   
    return { A_Const: result };
  }

  ColumnRef(node: PG14.ColumnRef, context: TransformerContext): { ColumnRef: PG15.ColumnRef } {
    const result = this.transformGenericNode(node, context);
    return { ColumnRef: result };
  }

  TypeName(node: PG14.TypeName, context: TransformerContext): { TypeName: PG15.TypeName } {
    const result = this.transformGenericNode(node, context);
    return { TypeName: result };
  }

  Alias(node: PG14.Alias, context: TransformerContext): { Alias: PG15.Alias } {
    const result = this.transformGenericNode(node, context);
    return { Alias: result };
  }

  RangeVar(node: PG14.RangeVar, context: TransformerContext): { RangeVar: PG15.RangeVar } {
    const result = this.transformGenericNode(node, context);
    return { RangeVar: result };
  }

  A_ArrayExpr(node: PG14.A_ArrayExpr, context: TransformerContext): { A_ArrayExpr: PG15.A_ArrayExpr } {
    const result = this.transformGenericNode(node, context);
    return { A_ArrayExpr: result };
  }

  A_Indices(node: PG14.A_Indices, context: TransformerContext): { A_Indices: PG15.A_Indices } {
    const result: any = {};
    
    if (node.is_slice !== undefined) {
      result.is_slice = node.is_slice;
    }
    
    if (node.lidx !== undefined) {
      result.lidx = this.transform(node.lidx as any, context);
    }
    
    if (node.uidx !== undefined) {
      const childContext = {
        ...context,
        parentNodeTypes: [...(context.parentNodeTypes || []), 'A_Indices']
      };
      result.uidx = this.transform(node.uidx as any, childContext);
    }
    
    return { A_Indices: result };
  }

  A_Indirection(node: PG14.A_Indirection, context: TransformerContext): { A_Indirection: PG15.A_Indirection } {
    const result = this.transformGenericNode(node, context);
    return { A_Indirection: result };
  }

  A_Star(node: PG14.A_Star, context: TransformerContext): { A_Star: PG15.A_Star } {
    const result = this.transformGenericNode(node, context);
    return { A_Star: result };
  }

  CaseExpr(node: PG14.CaseExpr, context: TransformerContext): { CaseExpr: PG15.CaseExpr } {
    const result = this.transformGenericNode(node, context);
    return { CaseExpr: result };
  }

  CoalesceExpr(node: PG14.CoalesceExpr, context: TransformerContext): { CoalesceExpr: PG15.CoalesceExpr } {
    const result = this.transformGenericNode(node, context);
    return { CoalesceExpr: result };
  }

  TypeCast(node: PG14.TypeCast, context: TransformerContext): { TypeCast: PG15.TypeCast } | { A_Const: PG15.A_Const } {
    if (node.location === -1 && node.typeName && node.typeName.names) {
      
      const typeNames = node.typeName.names.map(name => {
        if (name && typeof name === 'object' && 'String' in name) {
          const stringVal = name.String;
          return (stringVal as any).sval || (stringVal as any).str;
        }
        return null;
      }).filter(Boolean);
      
      const hasPgCatalog = typeNames.includes('pg_catalog');
      const hasBool = typeNames.includes('bool');
      
      if (hasPgCatalog && hasBool && node.arg) {
        const arg = node.arg as any;
        if (arg.A_Const) {
          let stringValue = null;
          
          // Handle both sval and val.String formats
          if (arg.A_Const.sval && arg.A_Const.sval.sval) {
            stringValue = arg.A_Const.sval.sval;
          } else if (arg.A_Const.val && arg.A_Const.val.String) {
            if (arg.A_Const.val.String.sval) {
              stringValue = arg.A_Const.val.String.sval;
            } else if (arg.A_Const.val.String.str) {
              stringValue = arg.A_Const.val.String.str;
            }
          }
          
          if (stringValue === 't' || stringValue === 'true') {
            return {
              A_Const: {
                boolval: { boolval: true },
                location: arg.A_Const.location
              }
            };
          } else if (stringValue === 'f' || stringValue === 'false') {
            return {
              A_Const: {
                boolval: {},
                location: arg.A_Const.location
              }
            };
          }
        }
      }
    }

    const result = this.transformGenericNode(node, context);
    return { TypeCast: result };
  }

  CollateClause(node: PG14.CollateClause, context: TransformerContext): { CollateClause: PG15.CollateClause } {
    const result = this.transformGenericNode(node, context);
    return { CollateClause: result };
  }

  BooleanTest(node: PG14.BooleanTest, context: TransformerContext): { BooleanTest: PG15.BooleanTest } {
    const result = this.transformGenericNode(node, context);
    return { BooleanTest: result };
  }

  NullTest(node: PG14.NullTest, context: TransformerContext): { NullTest: PG15.NullTest } {
    const result = this.transformGenericNode(node, context);
    return { NullTest: result };
  }

  String(node: PG14.String, context: TransformerContext): { String: PG15.String } {
    const result: any = { ...node };
    
    if (result.str !== undefined) {
      result.sval = result.str;
      delete result.str;
    }
    
    return { String: result };
  }
  
  Integer(node: PG14.Integer, context: TransformerContext): { Integer: PG15.Integer } | { Boolean: PG15.Boolean } {
    const isInDefElemContext = context.parentNodeTypes?.includes('DefElem');
    if (isInDefElemContext && node.ival !== undefined) {
      const defElemName = (context as any).defElemName;
      
      // CreateRoleStmt: specific role attributes should become Boolean
      if (defElemName && ['createrole', 'superuser', 'canlogin', 'createdb', 'inherit', 'bypassrls', 'isreplication'].includes(defElemName) && 
          (node.ival === 0 || node.ival === 1)) {
        return {
          Boolean: {
            boolval: node.ival === 1
          }
        };
      }
      
      // CreateExtensionStmt: cascade should become Boolean
      if (context.parentNodeTypes?.includes('CreateExtensionStmt') && defElemName) {
        if (defElemName === 'cascade' && (node.ival === 0 || node.ival === 1)) {
          return {
            Boolean: {
              boolval: node.ival === 1
            }
          };
        }
      }
      
      
      // CreateFunctionStmt: window should become Boolean
      if (context.parentNodeTypes?.includes('CreateFunctionStmt') && defElemName) {
        if (defElemName === 'window' && (node.ival === 0 || node.ival === 1)) {
          return {
            Boolean: {
              boolval: node.ival === 1
            }
          };
        }
      }
      
      if (['strict', 'security', 'leakproof', 'cycle'].includes(defElemName) && (node.ival === 0 || node.ival === 1)) {
        return {
          Boolean: {
            boolval: node.ival === 1
          }
        };
      }
      
    }
    
    // AlterTableCmd context: SET STATISTICS with ival 0 or -1 -> empty Integer
    if (context.parentNodeTypes?.includes('AlterTableCmd') && !context.parentNodeTypes?.includes('DefineStmt') && (node.ival === 0)) {
      return { Integer: {} };
    }
    
    // DefineStmt context: specific cases where ival should become empty Integer
    if (context.parentNodeTypes?.includes('DefineStmt')) {
      const defElemName = (context as any).defElemName;
      
      if (defElemName === 'initcond' && (node.ival === 0)) {
        return { Integer: {} };
      }
      
      if (defElemName === 'sspace' && node.ival === 0) {
        return { Integer: {} };
      }
      
      // DefineStmt args context: ival 0 should become empty Integer for aggregates
      if (!defElemName && (node.ival === 0)) {
        return { Integer: {} };
      }
    }
    
    // CreateSeqStmt context: specific cases where ival should become empty Integer
    if (context.parentNodeTypes?.includes('CreateSeqStmt')) {
      const defElemName = (context as any).defElemName;
      
      if (defElemName === 'start' && node.ival === 0) {
        return { Integer: {} };
      }
      
      if (defElemName === 'minvalue' && node.ival === 0) {
        return { Integer: {} };
      }
      
      if (defElemName === 'increment' && node.ival === 0) {
        return { Integer: {} };
      }
    }
    
    const result: any = { ...node };
    return { Integer: result };
  }
  
  Float(node: PG14.Float, context: TransformerContext): { Float: PG15.Float } {
    const result: any = { ...node };
    
    if (result.str !== undefined) {
      result.fval = result.str;
      delete result.str;
    }
    
    return { Float: result };
  }
    
  BitString(node: PG14.BitString, context: TransformerContext): { BitString: PG15.BitString } {
    const result: any = { ...node };
    
    if (result.str !== undefined) {
      result.bsval = result.str;
      delete result.str;
    }
    
    return { BitString: result };
  }
  
  // NOTE: there is no Null type in PG15
  Null(node: PG14.Node, context: TransformerContext): any {
    const result = this.transformGenericNode(node, context);
    return { Null: result };
  }

  List(node: PG14.List, context: TransformerContext): { List: PG15.List } {
    const result = this.transformGenericNode(node, context);
    return { List: result };
  }

  CreateStmt(node: PG14.CreateStmt, context: TransformerContext): { CreateStmt: PG15.CreateStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateStmt: result };
  }

  ColumnDef(node: PG14.ColumnDef, context: TransformerContext): { ColumnDef: PG15.ColumnDef } {
    const result = this.transformGenericNode(node, context);
    return { ColumnDef: result };
  }

  Constraint(node: PG14.Constraint, context: TransformerContext): { Constraint: PG15.Constraint } {
    const result = this.transformGenericNode(node, context);
    return { Constraint: result };
  }

  SubLink(node: PG14.SubLink, context: TransformerContext): { SubLink: PG15.SubLink } {
    const result = this.transformGenericNode(node, context);
    return { SubLink: result };
  }

  CaseWhen(node: PG14.CaseWhen, context: TransformerContext): { CaseWhen: PG15.CaseWhen } {
    const result = this.transformGenericNode(node, context);
    return { CaseWhen: result };
  }

  WindowDef(node: PG14.WindowDef, context: TransformerContext): { WindowDef: PG15.WindowDef } {
    const result = this.transformGenericNode(node, context);
    return { WindowDef: result };
  }

  SortBy(node: PG14.SortBy, context: TransformerContext): { SortBy: PG15.SortBy } {
    const result = this.transformGenericNode(node, context);
    return { SortBy: result };
  }

  GroupingSet(node: PG14.GroupingSet, context: TransformerContext): { GroupingSet: PG15.GroupingSet } {
    const result = this.transformGenericNode(node, context);
    return { GroupingSet: result };
  }

  CommonTableExpr(node: PG14.CommonTableExpr, context: TransformerContext): { CommonTableExpr: PG15.CommonTableExpr } {
    const result = this.transformGenericNode(node, context);
    return { CommonTableExpr: result };
  }

  ParamRef(node: PG14.ParamRef, context: TransformerContext): { ParamRef: PG15.ParamRef } {
    const result = this.transformGenericNode(node, context);
    return { ParamRef: result };
  }

  LockingClause(node: any, context: TransformerContext): { LockingClause: PG15.LockingClause } {
    const result = this.transformGenericNode(node, context);
    return { LockingClause: result };
  }

  MinMaxExpr(node: PG14.MinMaxExpr, context: TransformerContext): { MinMaxExpr: PG15.MinMaxExpr } {
    const result = this.transformGenericNode(node, context);
    return { MinMaxExpr: result };
  }

  RowExpr(node: PG14.RowExpr, context: TransformerContext): { RowExpr: PG15.RowExpr } {
    const result = this.transformGenericNode(node, context);
    return { RowExpr: result };
  }

  OpExpr(node: PG14.OpExpr, context: TransformerContext): { OpExpr: PG15.OpExpr } {
    const result = this.transformGenericNode(node, context);
    return { OpExpr: result };
  }

  DistinctExpr(node: PG14.DistinctExpr, context: TransformerContext): { DistinctExpr: PG15.DistinctExpr } {
    const result = this.transformGenericNode(node, context);
    return { DistinctExpr: result };
  }

  NullIfExpr(node: PG14.NullIfExpr, context: TransformerContext): { NullIfExpr: PG15.NullIfExpr } {
    const result = this.transformGenericNode(node, context);
    return { NullIfExpr: result };
  }

  ScalarArrayOpExpr(node: PG14.ScalarArrayOpExpr, context: TransformerContext): { ScalarArrayOpExpr: PG15.ScalarArrayOpExpr } {
    const result = this.transformGenericNode(node, context);
    return { ScalarArrayOpExpr: result };
  }

  Aggref(node: PG14.Aggref, context: TransformerContext): { Aggref: PG15.Aggref } {
    const result = this.transformGenericNode(node, context);
    return { Aggref: result };
  }

  WindowFunc(node: PG14.WindowFunc, context: TransformerContext): { WindowFunc: PG15.WindowFunc } {
    const result = this.transformGenericNode(node, context);
    return { WindowFunc: result };
  }

  FieldSelect(node: PG14.FieldSelect, context: TransformerContext): { FieldSelect: PG15.FieldSelect } {
    const result = this.transformGenericNode(node, context);
    return { FieldSelect: result };
  }

  RelabelType(node: PG14.RelabelType, context: TransformerContext): { RelabelType: PG15.RelabelType } {
    const result = this.transformGenericNode(node, context);
    return { RelabelType: result };
  }

  CoerceViaIO(node: PG14.CoerceViaIO, context: TransformerContext): { CoerceViaIO: PG15.CoerceViaIO } {
    const result = this.transformGenericNode(node, context);
    return { CoerceViaIO: result };
  }

  ArrayCoerceExpr(node: PG14.ArrayCoerceExpr, context: TransformerContext): { ArrayCoerceExpr: PG15.ArrayCoerceExpr } {
    const result = this.transformGenericNode(node, context);
    return { ArrayCoerceExpr: result };
  }

  ConvertRowtypeExpr(node: PG14.ConvertRowtypeExpr, context: TransformerContext): { ConvertRowtypeExpr: PG15.ConvertRowtypeExpr } {
    const result = this.transformGenericNode(node, context);
    return { ConvertRowtypeExpr: result };
  }

  NamedArgExpr(node: PG14.NamedArgExpr, context: TransformerContext): { NamedArgExpr: PG15.NamedArgExpr } {
    const result = this.transformGenericNode(node, context);
    return { NamedArgExpr: result };
  }

  ViewStmt(node: PG14.ViewStmt, context: TransformerContext): { ViewStmt: PG15.ViewStmt } {
    const result = this.transformGenericNode(node, context);
    return { ViewStmt: result };
  }

  IndexStmt(node: PG14.IndexStmt, context: TransformerContext): { IndexStmt: PG15.IndexStmt } {
    const result = this.transformGenericNode(node, context);
    return { IndexStmt: result };
  }

  IndexElem(node: PG14.IndexElem, context: TransformerContext): { IndexElem: PG15.IndexElem } {
    const result = this.transformGenericNode(node, context);
    return { IndexElem: result };
  }

  PartitionElem(node: PG14.PartitionElem, context: TransformerContext): { PartitionElem: PG15.PartitionElem } {
    const result = this.transformGenericNode(node, context);
    return { PartitionElem: result };
  }

  PartitionCmd(node: PG14.PartitionCmd, context: TransformerContext): { PartitionCmd: PG15.PartitionCmd } {
    const result = this.transformGenericNode(node, context);
    return { PartitionCmd: result };
  }

  JoinExpr(node: PG14.JoinExpr, context: TransformerContext): { JoinExpr: PG15.JoinExpr } {
    const result = this.transformGenericNode(node, context);
    return { JoinExpr: result };
  }

  FromExpr(node: PG14.FromExpr, context: TransformerContext): { FromExpr: PG15.FromExpr } {
    const result = this.transformGenericNode(node, context);
    return { FromExpr: result };
  }

  TransactionStmt(node: PG14.TransactionStmt, context: TransformerContext): { TransactionStmt: PG15.TransactionStmt } {
    const result = this.transformGenericNode(node, context);
    return { TransactionStmt: result };
  }

  VariableSetStmt(node: PG14.VariableSetStmt, context: TransformerContext): { VariableSetStmt: PG15.VariableSetStmt } {
    const result = this.transformGenericNode(node, context);
    return { VariableSetStmt: result };
  }

  VariableShowStmt(node: PG14.VariableShowStmt, context: TransformerContext): { VariableShowStmt: PG15.VariableShowStmt } {
    const result = this.transformGenericNode(node, context);
    return { VariableShowStmt: result };
  }

  CreateSchemaStmt(node: PG14.CreateSchemaStmt, context: TransformerContext): { CreateSchemaStmt: PG15.CreateSchemaStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateSchemaStmt: result };
  }

  RoleSpec(node: PG14.RoleSpec, context: TransformerContext): { RoleSpec: PG15.RoleSpec } {
    const result = this.transformGenericNode(node, context);
    return { RoleSpec: result };
  }

  DropStmt(node: PG14.DropStmt, context: TransformerContext): { DropStmt: PG15.DropStmt } {
    const result = this.transformGenericNode(node, context);
    return { DropStmt: result };
  }

  TruncateStmt(node: PG14.TruncateStmt, context: TransformerContext): { TruncateStmt: PG15.TruncateStmt } {
    const result = this.transformGenericNode(node, context);
    return { TruncateStmt: result };
  }

  ReturnStmt(node: PG14.ReturnStmt, context: TransformerContext): { ReturnStmt: PG15.ReturnStmt } {
    const result: any = {};

    if (node.returnval !== undefined) {
      result.returnval = this.transform(node.returnval as any, context);
    }

    return { ReturnStmt: result };
  }

  PLAssignStmt(node: PG14.PLAssignStmt, context: TransformerContext): { PLAssignStmt: PG15.PLAssignStmt } {
    const result = this.transformGenericNode(node, context);
    return { PLAssignStmt: result };
  }

  CopyStmt(node: PG14.CopyStmt, context: TransformerContext): { CopyStmt: PG15.CopyStmt } {
    const result: any = {};

    if (node.relation !== undefined) {
      result.relation = this.transform(node.relation as any, context);
    }

    if (node.query !== undefined) {
      result.query = this.transform(node.query as any, context);
    }

    if (node.attlist !== undefined) {
      result.attlist = Array.isArray(node.attlist)
        ? node.attlist.map(item => this.transform(item as any, context))
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
        ? node.options.map(item => this.transform(item as any, context))
        : this.transform(node.options as any, context);
    }

    if (node.whereClause !== undefined) {
      result.whereClause = this.transform(node.whereClause as any, context);
    }

    return { CopyStmt: result };
  }

  AlterTableStmt(node: PG14.AlterTableStmt, context: TransformerContext): { AlterTableStmt: PG15.AlterTableStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterTableStmt: result };
  }

  AlterTableCmd(node: PG14.AlterTableCmd, context: TransformerContext): { AlterTableCmd: PG15.AlterTableCmd } {
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

  CreateFunctionStmt(node: PG14.CreateFunctionStmt, context: TransformerContext): { CreateFunctionStmt: PG15.CreateFunctionStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateFunctionStmt: result };
  }

  FunctionParameter(node: PG14.FunctionParameter, context: TransformerContext): { FunctionParameter: PG15.FunctionParameter } {
    const result = this.transformGenericNode(node, context);
    return { FunctionParameter: result };
  }

  CompositeTypeStmt(node: PG14.CompositeTypeStmt, context: TransformerContext): { CompositeTypeStmt: PG15.CompositeTypeStmt } {
    const result = this.transformGenericNode(node, context);
    return { CompositeTypeStmt: result };
  }

  CreateEnumStmt(node: PG14.CreateEnumStmt, context: TransformerContext): { CreateEnumStmt: PG15.CreateEnumStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateEnumStmt: result };
  }

  CreateDomainStmt(node: PG14.CreateDomainStmt, context: TransformerContext): { CreateDomainStmt: PG15.CreateDomainStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateDomainStmt: result };
  }

  CreateRoleStmt(node: PG14.CreateRoleStmt, context: TransformerContext): { CreateRoleStmt: PG15.CreateRoleStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateRoleStmt: result };
  }

  DefElem(node: PG14.DefElem, context: TransformerContext): { DefElem: PG15.DefElem } {
    const result: any = {};

    if (node.defnamespace !== undefined) {
      result.defnamespace = node.defnamespace;
    }

    if (node.defname !== undefined) {
      result.defname = node.defname;
    }

    if (node.arg !== undefined) {
      const argContext = {
        ...context,
        defElemName: node.defname,
        parentNodeTypes: [...(context.parentNodeTypes || []), 'DefElem']
      };
      result.arg = this.transform(node.arg as any, argContext);
    }

    if (node.defaction !== undefined) {
      result.defaction = node.defaction;
    }

    if (node.location !== undefined) {
      result.location = node.location;
    }

    return { DefElem: result };
  }


  CreateTableSpaceStmt(node: PG14.CreateTableSpaceStmt, context: TransformerContext): { CreateTableSpaceStmt: PG15.CreateTableSpaceStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateTableSpaceStmt: result };
  }

  DropTableSpaceStmt(node: PG14.DropTableSpaceStmt, context: TransformerContext): { DropTableSpaceStmt: PG15.DropTableSpaceStmt } {
    const result = this.transformGenericNode(node, context);
    return { DropTableSpaceStmt: result };
  }

  AlterTableSpaceOptionsStmt(node: PG14.AlterTableSpaceOptionsStmt, context: TransformerContext): { AlterTableSpaceOptionsStmt: PG15.AlterTableSpaceOptionsStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterTableSpaceOptionsStmt: result };
  }

  CreateExtensionStmt(node: PG14.CreateExtensionStmt, context: TransformerContext): { CreateExtensionStmt: PG15.CreateExtensionStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateExtensionStmt: result };
  }

  AlterExtensionStmt(node: PG14.AlterExtensionStmt, context: TransformerContext): { AlterExtensionStmt: PG15.AlterExtensionStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterExtensionStmt: result };
  }

  CreateFdwStmt(node: PG14.CreateFdwStmt, context: TransformerContext): { CreateFdwStmt: PG15.CreateFdwStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateFdwStmt: result };
  }

  SetOperationStmt(node: PG14.SetOperationStmt, context: TransformerContext): { SetOperationStmt: PG15.SetOperationStmt } {
    const result = this.transformGenericNode(node, context);
    return { SetOperationStmt: result };
  }

  ReplicaIdentityStmt(node: PG14.ReplicaIdentityStmt, context: TransformerContext): { ReplicaIdentityStmt: PG15.ReplicaIdentityStmt } {
    const result = this.transformGenericNode(node, context);
    return { ReplicaIdentityStmt: result };
  }

  AlterCollationStmt(node: PG14.AlterCollationStmt, context: TransformerContext): { AlterCollationStmt: PG15.AlterCollationStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterCollationStmt: result };
  }

  AlterDomainStmt(node: PG14.AlterDomainStmt, context: TransformerContext): { AlterDomainStmt: PG15.AlterDomainStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterDomainStmt: result };
  }

  PrepareStmt(node: PG14.PrepareStmt, context: TransformerContext): { PrepareStmt: PG15.PrepareStmt } {
    const result = this.transformGenericNode(node, context);
    return { PrepareStmt: result };
  }

  ExecuteStmt(node: PG14.ExecuteStmt, context: TransformerContext): { ExecuteStmt: PG15.ExecuteStmt } {
    const result = this.transformGenericNode(node, context);
    return { ExecuteStmt: result };
  }

  DeallocateStmt(node: PG14.DeallocateStmt, context: TransformerContext): { DeallocateStmt: PG15.DeallocateStmt } {
    const result = this.transformGenericNode(node, context);
    return { DeallocateStmt: result };
  }

  NotifyStmt(node: PG14.NotifyStmt, context: TransformerContext): { NotifyStmt: PG15.NotifyStmt } {
    const result = this.transformGenericNode(node, context);
    return { NotifyStmt: result };
  }

  ListenStmt(node: PG14.ListenStmt, context: TransformerContext): { ListenStmt: PG15.ListenStmt } {
    const result = this.transformGenericNode(node, context);
    return { ListenStmt: result };
  }

  UnlistenStmt(node: PG14.UnlistenStmt, context: TransformerContext): { UnlistenStmt: PG15.UnlistenStmt } {
    const result = this.transformGenericNode(node, context);
    return { UnlistenStmt: result };
  }

  CheckPointStmt(node: PG14.CheckPointStmt, context: TransformerContext): { CheckPointStmt: PG15.CheckPointStmt } {
    const result = this.transformGenericNode(node, context);
    return { CheckPointStmt: result };
  }

  LoadStmt(node: PG14.LoadStmt, context: TransformerContext): { LoadStmt: PG15.LoadStmt } {
    const result = this.transformGenericNode(node, context);
    return { LoadStmt: result };
  }

  DiscardStmt(node: PG14.DiscardStmt, context: TransformerContext): { DiscardStmt: PG15.DiscardStmt } {
    const result = this.transformGenericNode(node, context);
    return { DiscardStmt: result };
  }

  CommentStmt(node: PG14.CommentStmt, context: TransformerContext): { CommentStmt: PG15.CommentStmt } {
    const result = this.transformGenericNode(node, context);
    return { CommentStmt: result };
  }

  LockStmt(node: PG14.LockStmt, context: TransformerContext): { LockStmt: PG15.LockStmt } {
    const result = this.transformGenericNode(node, context);
    return { LockStmt: result };
  }

  CreatePolicyStmt(node: PG14.CreatePolicyStmt, context: TransformerContext): { CreatePolicyStmt: PG15.CreatePolicyStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreatePolicyStmt: result };
  }

  AlterPolicyStmt(node: PG14.AlterPolicyStmt, context: TransformerContext): { AlterPolicyStmt: PG15.AlterPolicyStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterPolicyStmt: result };
  }

  CreateUserMappingStmt(node: PG14.CreateUserMappingStmt, context: TransformerContext): { CreateUserMappingStmt: PG15.CreateUserMappingStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateUserMappingStmt: result };
  }

  CreateStatsStmt(node: PG14.CreateStatsStmt, context: TransformerContext): { CreateStatsStmt: PG15.CreateStatsStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateStatsStmt: result };
  }

  StatsElem(node: PG14.StatsElem, context: TransformerContext): { StatsElem: PG15.StatsElem } {
    const result = this.transformGenericNode(node, context);
    return { StatsElem: result };
  }

  CreatePublicationStmt(node: PG14.CreatePublicationStmt, context: TransformerContext): { CreatePublicationStmt: PG15.CreatePublicationStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreatePublicationStmt: result };
  }

  CreateSubscriptionStmt(node: PG14.CreateSubscriptionStmt, context: TransformerContext): { CreateSubscriptionStmt: PG15.CreateSubscriptionStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateSubscriptionStmt: result };
  }

  AlterPublicationStmt(node: PG14.AlterPublicationStmt, context: TransformerContext): { AlterPublicationStmt: PG15.AlterPublicationStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterPublicationStmt: result };
  }

  AlterSubscriptionStmt(node: PG14.AlterSubscriptionStmt, context: TransformerContext): { AlterSubscriptionStmt: PG15.AlterSubscriptionStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterSubscriptionStmt: result };
  }

  DropSubscriptionStmt(node: PG14.DropSubscriptionStmt, context: TransformerContext): { DropSubscriptionStmt: PG15.DropSubscriptionStmt } {
    const result = this.transformGenericNode(node, context);
    return { DropSubscriptionStmt: result };
  }

  DoStmt(node: PG14.DoStmt, context: TransformerContext): { DoStmt: PG15.DoStmt } {
    const result = this.transformGenericNode(node, context);
    return { DoStmt: result };
  }

  InlineCodeBlock(node: PG14.InlineCodeBlock, context: TransformerContext): { InlineCodeBlock: PG15.InlineCodeBlock } {
    const result = this.transformGenericNode(node, context);
    return { InlineCodeBlock: result };
  }

  CallContext(node: PG14.CallContext, context: TransformerContext): { CallContext: PG15.CallContext } {
    const result = this.transformGenericNode(node, context);
    return { CallContext: result };
  }

  ConstraintsSetStmt(node: PG14.ConstraintsSetStmt, context: TransformerContext): { ConstraintsSetStmt: PG15.ConstraintsSetStmt } {
    const result = this.transformGenericNode(node, context);
    return { ConstraintsSetStmt: result };
  }

  AlterSystemStmt(node: PG14.AlterSystemStmt, context: TransformerContext): { AlterSystemStmt: PG15.AlterSystemStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterSystemStmt: result };
  }

  VacuumRelation(node: PG14.VacuumRelation, context: TransformerContext): { VacuumRelation: PG15.VacuumRelation } {
    const result = this.transformGenericNode(node, context);
    return { VacuumRelation: result };
  }

  DropOwnedStmt(node: PG14.DropOwnedStmt, context: TransformerContext): { DropOwnedStmt: PG15.DropOwnedStmt } {
    const result = this.transformGenericNode(node, context);
    return { DropOwnedStmt: result };
  }

  ReassignOwnedStmt(node: PG14.ReassignOwnedStmt, context: TransformerContext): { ReassignOwnedStmt: PG15.ReassignOwnedStmt } {
    const result = this.transformGenericNode(node, context);
    return { ReassignOwnedStmt: result };
  }

  AlterTSDictionaryStmt(node: PG14.AlterTSDictionaryStmt, context: TransformerContext): { AlterTSDictionaryStmt: PG15.AlterTSDictionaryStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterTSDictionaryStmt: result };
  }

  AlterTSConfigurationStmt(node: PG14.AlterTSConfigurationStmt, context: TransformerContext): { AlterTSConfigurationStmt: PG15.AlterTSConfigurationStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterTSConfigurationStmt: result };
  }

  ClosePortalStmt(node: PG14.ClosePortalStmt, context: TransformerContext): { ClosePortalStmt: PG15.ClosePortalStmt } {
    const result = this.transformGenericNode(node, context);
    return { ClosePortalStmt: result };
  }

  FetchStmt(node: PG14.FetchStmt, context: TransformerContext): { FetchStmt: PG15.FetchStmt } {
    const result = this.transformGenericNode(node, context);
    return { FetchStmt: result };
  }

  AlterStatsStmt(node: PG14.AlterStatsStmt, context: TransformerContext): { AlterStatsStmt: PG15.AlterStatsStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterStatsStmt: result };
  }

  ObjectWithArgs(node: PG14.ObjectWithArgs, context: TransformerContext): { ObjectWithArgs: PG15.ObjectWithArgs } {
    const result = this.transformGenericNode(node, context);
    return { ObjectWithArgs: result };
  }

  AlterOperatorStmt(node: PG14.AlterOperatorStmt, context: TransformerContext): { AlterOperatorStmt: PG15.AlterOperatorStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterOperatorStmt: result };
  }

  AlterFdwStmt(node: PG14.AlterFdwStmt, context: TransformerContext): { AlterFdwStmt: PG15.AlterFdwStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterFdwStmt: result };
  }

  CreateForeignServerStmt(node: PG14.CreateForeignServerStmt, context: TransformerContext): { CreateForeignServerStmt: PG15.CreateForeignServerStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateForeignServerStmt: result };
  }

  AlterForeignServerStmt(node: PG14.AlterForeignServerStmt, context: TransformerContext): { AlterForeignServerStmt: PG15.AlterForeignServerStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterForeignServerStmt: result };
  }

  AlterUserMappingStmt(node: PG14.AlterUserMappingStmt, context: TransformerContext): { AlterUserMappingStmt: PG15.AlterUserMappingStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterUserMappingStmt: result };
  }

  DropUserMappingStmt(node: PG14.DropUserMappingStmt, context: TransformerContext): { DropUserMappingStmt: PG15.DropUserMappingStmt } {
    const result = this.transformGenericNode(node, context);
    return { DropUserMappingStmt: result };
  }

  ImportForeignSchemaStmt(node: PG14.ImportForeignSchemaStmt, context: TransformerContext): { ImportForeignSchemaStmt: PG15.ImportForeignSchemaStmt } {
    const result = this.transformGenericNode(node, context);
    return { ImportForeignSchemaStmt: result };
  }

  ClusterStmt(node: PG14.ClusterStmt, context: TransformerContext): { ClusterStmt: PG15.ClusterStmt } {
    const result = this.transformGenericNode(node, context);
    return { ClusterStmt: result };
  }

  VacuumStmt(node: PG14.VacuumStmt, context: TransformerContext): { VacuumStmt: PG15.VacuumStmt } {
    const result = this.transformGenericNode(node, context);
    return { VacuumStmt: result };
  }

  ExplainStmt(node: PG14.ExplainStmt, context: TransformerContext): { ExplainStmt: PG15.ExplainStmt } {
    const result = this.transformGenericNode(node, context);
    return { ExplainStmt: result };
  }

  ReindexStmt(node: PG14.ReindexStmt, context: TransformerContext): { ReindexStmt: PG15.ReindexStmt } {
    const result = this.transformGenericNode(node, context);
    return { ReindexStmt: result };
  }

  CallStmt(node: PG14.CallStmt, context: TransformerContext): { CallStmt: PG15.CallStmt } {
    const result = this.transformGenericNode(node, context);
    return { CallStmt: result };
  }

  CreatedbStmt(node: PG14.CreatedbStmt, context: TransformerContext): { CreatedbStmt: PG15.CreatedbStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreatedbStmt: result };
  }

  DropdbStmt(node: PG14.DropdbStmt, context: TransformerContext): { DropdbStmt: PG15.DropdbStmt } {
    const result = this.transformGenericNode(node, context);
    return { DropdbStmt: result };
  }

  RenameStmt(node: PG14.RenameStmt, context: TransformerContext): { RenameStmt: PG15.RenameStmt } {
    const result = this.transformGenericNode(node, context);
    return { RenameStmt: result };
  }

  AlterOwnerStmt(node: PG14.AlterOwnerStmt, context: TransformerContext): { AlterOwnerStmt: PG15.AlterOwnerStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterOwnerStmt: result };
  }

  GrantStmt(node: PG14.GrantStmt, context: TransformerContext): { GrantStmt: PG15.GrantStmt } {
    const result = this.transformGenericNode(node, context);
    return { GrantStmt: result };
  }

  GrantRoleStmt(node: PG14.GrantRoleStmt, context: TransformerContext): { GrantRoleStmt: PG15.GrantRoleStmt } {
    const result = this.transformGenericNode(node, context);
    return { GrantRoleStmt: result };
  }

  SecLabelStmt(node: PG14.SecLabelStmt, context: TransformerContext): { SecLabelStmt: PG15.SecLabelStmt } {
    const result = this.transformGenericNode(node, context);
    return { SecLabelStmt: result };
  }

  AlterDefaultPrivilegesStmt(node: PG14.AlterDefaultPrivilegesStmt, context: TransformerContext): { AlterDefaultPrivilegesStmt: PG15.AlterDefaultPrivilegesStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterDefaultPrivilegesStmt: result };
  }

  CreateConversionStmt(node: PG14.CreateConversionStmt, context: TransformerContext): { CreateConversionStmt: PG15.CreateConversionStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateConversionStmt: result };
  }

  CreateCastStmt(node: PG14.CreateCastStmt, context: TransformerContext): { CreateCastStmt: PG15.CreateCastStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateCastStmt: result };
  }

  CreatePLangStmt(node: PG14.CreatePLangStmt, context: TransformerContext): { CreatePLangStmt: PG15.CreatePLangStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreatePLangStmt: result };
  }

  CreateTransformStmt(node: PG14.CreateTransformStmt, context: TransformerContext): { CreateTransformStmt: PG15.CreateTransformStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateTransformStmt: result };
  }

  CreateTrigStmt(node: PG14.CreateTrigStmt, context: TransformerContext): { CreateTrigStmt: PG15.CreateTrigStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateTrigStmt: result };
  }

  TriggerTransition(node: PG14.TriggerTransition, context: TransformerContext): { TriggerTransition: PG15.TriggerTransition } {
    const result = this.transformGenericNode(node, context);
    return { TriggerTransition: result };
  }

  CreateEventTrigStmt(node: PG14.CreateEventTrigStmt, context: TransformerContext): { CreateEventTrigStmt: PG15.CreateEventTrigStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateEventTrigStmt: result };
  }

  AlterEventTrigStmt(node: PG14.AlterEventTrigStmt, context: TransformerContext): { AlterEventTrigStmt: PG15.AlterEventTrigStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterEventTrigStmt: result };
  }

  CreateOpClassStmt(node: PG14.CreateOpClassStmt, context: TransformerContext): { CreateOpClassStmt: PG15.CreateOpClassStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateOpClassStmt: result };
  }

  CreateOpFamilyStmt(node: PG14.CreateOpFamilyStmt, context: TransformerContext): { CreateOpFamilyStmt: PG15.CreateOpFamilyStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateOpFamilyStmt: result };
  }

  AlterOpFamilyStmt(node: PG14.AlterOpFamilyStmt, context: TransformerContext): { AlterOpFamilyStmt: PG15.AlterOpFamilyStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterOpFamilyStmt: result };
  }

  AlterTableMoveAllStmt(node: PG14.AlterTableMoveAllStmt, context: TransformerContext): { AlterTableMoveAllStmt: PG15.AlterTableMoveAllStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterTableMoveAllStmt: result };
  }

  CreateSeqStmt(node: PG14.CreateSeqStmt, context: TransformerContext): { CreateSeqStmt: PG15.CreateSeqStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateSeqStmt: result };
  }

  AlterSeqStmt(node: PG14.AlterSeqStmt, context: TransformerContext): { AlterSeqStmt: PG15.AlterSeqStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterSeqStmt: result };
  }


  CreateRangeStmt(node: PG14.CreateRangeStmt, context: TransformerContext): { CreateRangeStmt: PG15.CreateRangeStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateRangeStmt: result };
  }

  AlterEnumStmt(node: PG14.AlterEnumStmt, context: TransformerContext): { AlterEnumStmt: PG15.AlterEnumStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterEnumStmt: result };
  }

  AlterTypeStmt(node: PG14.AlterTypeStmt, context: TransformerContext): { AlterTypeStmt: PG15.AlterTypeStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterTypeStmt: result };
  }

  AlterRoleStmt(node: PG14.AlterRoleStmt, context: TransformerContext): { AlterRoleStmt: PG15.AlterRoleStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterRoleStmt: result };
  }

  DropRoleStmt(node: PG14.DropRoleStmt, context: TransformerContext): { DropRoleStmt: PG15.DropRoleStmt } {
    const result = this.transformGenericNode(node, context);
    return { DropRoleStmt: result };
  }


  CreateTableAsStmt(node: PG14.CreateTableAsStmt, context: TransformerContext): { CreateTableAsStmt: PG15.CreateTableAsStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateTableAsStmt: result };
  }

  RefreshMatViewStmt(node: PG14.RefreshMatViewStmt, context: TransformerContext): { RefreshMatViewStmt: PG15.RefreshMatViewStmt } {
    const result = this.transformGenericNode(node, context);
    return { RefreshMatViewStmt: result };
  }

  AccessPriv(node: PG14.AccessPriv, context: TransformerContext): { AccessPriv: PG15.AccessPriv } {
    const result = this.transformGenericNode(node, context);
    return { AccessPriv: result };
  }

  DefineStmt(node: PG14.DefineStmt, context: TransformerContext): { DefineStmt: PG15.DefineStmt } {
    const result: any = {};

    if (node.kind !== undefined) {
      result.kind = node.kind;
    }

    if (node.oldstyle !== undefined) {
      result.oldstyle = node.oldstyle;
    }

    if (node.defnames !== undefined) {
      result.defnames = Array.isArray(node.defnames)
        ? node.defnames.map(item => this.transform(item as any, context))
        : this.transform(node.defnames as any, context);
    }

    if (node.args !== undefined) {
      result.args = Array.isArray(node.args)
        ? node.args.map(item => this.transform(item as any, context))
        : this.transform(node.args as any, context);
    }

    if (node.definition !== undefined) {
      result.definition = Array.isArray(node.definition)
        ? node.definition.map(item => this.transform(item as any, context))
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

  AlterDatabaseStmt(node: PG14.AlterDatabaseStmt, context: TransformerContext): { AlterDatabaseStmt: PG15.AlterDatabaseStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterDatabaseStmt: result };
  }

  AlterDatabaseSetStmt(node: PG14.AlterDatabaseSetStmt, context: TransformerContext): { AlterDatabaseSetStmt: PG15.AlterDatabaseSetStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterDatabaseSetStmt: result };
  }

  DeclareCursorStmt(node: PG14.DeclareCursorStmt, context: TransformerContext): { DeclareCursorStmt: PG15.DeclareCursorStmt } {
    const result = this.transformGenericNode(node, context);
    return { DeclareCursorStmt: result };
  }

  CreateAmStmt(node: PG14.CreateAmStmt, context: TransformerContext): { CreateAmStmt: PG15.CreateAmStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateAmStmt: result };
  }

  IntoClause(node: PG14.IntoClause, context: TransformerContext): { IntoClause: PG15.IntoClause } {
    const result = this.transformGenericNode(node, context);
    return { IntoClause: result };
  }

  OnConflictExpr(node: PG14.OnConflictExpr, context: TransformerContext): { OnConflictExpr: PG15.OnConflictExpr } {
    const result = this.transformGenericNode(node, context);
    return { OnConflictExpr: result };
  }

  ScanToken(node: PG14.ScanToken, context: TransformerContext): { ScanToken: PG15.ScanToken } {
    const result = this.transformGenericNode(node, context);
    return { ScanToken: result };
  }

  CreateOpClassItem(node: PG14.CreateOpClassItem, context: TransformerContext): { CreateOpClassItem: PG15.CreateOpClassItem } {
    const result = this.transformGenericNode(node, context);
    return { CreateOpClassItem: result };
  }

  Var(node: PG14.Var, context: TransformerContext): { Var: PG15.Var } {
    const result = this.transformGenericNode(node, context);
    return { Var: result };
  }

  TableFunc(node: PG14.TableFunc, context: TransformerContext): { TableFunc: PG15.TableFunc } {
    const result = this.transformGenericNode(node, context);
    return { TableFunc: result };
  }

  RangeTableFunc(node: PG14.RangeTableFunc, context: TransformerContext): { RangeTableFunc: PG15.RangeTableFunc } {
    const result = this.transformGenericNode(node, context);
    return { RangeTableFunc: result };
  }

  RangeTableFuncCol(node: PG14.RangeTableFuncCol, context: TransformerContext): { RangeTableFuncCol: PG15.RangeTableFuncCol } {
    const result = this.transformGenericNode(node, context);
    return { RangeTableFuncCol: result };
  }

  RangeFunction(node: PG14.RangeFunction, context: TransformerContext): { RangeFunction: PG15.RangeFunction } {
    const result = this.transformGenericNode(node, context);
    return { RangeFunction: result };
  }

  XmlExpr(node: PG14.XmlExpr, context: TransformerContext): { XmlExpr: PG15.XmlExpr } {
    const result = this.transformGenericNode(node, context);
    return { XmlExpr: result };
  }

  RangeTableSample(node: PG14.RangeTableSample, context: TransformerContext): { RangeTableSample: PG15.RangeTableSample } {
    const result = this.transformGenericNode(node, context);
    return { RangeTableSample: result };
  }

  XmlSerialize(node: PG14.XmlSerialize, context: TransformerContext): { XmlSerialize: PG15.XmlSerialize } {
    const result = this.transformGenericNode(node, context);
    return { XmlSerialize: result };
  }

  RuleStmt(node: PG14.RuleStmt, context: TransformerContext): { RuleStmt: PG15.RuleStmt } {
    const result = this.transformGenericNode(node, context);
    return { RuleStmt: result };
  }

  RangeSubselect(node: PG14.RangeSubselect, context: TransformerContext): { RangeSubselect: PG15.RangeSubselect } {
    const result = this.transformGenericNode(node, context);
    return { RangeSubselect: result };
  }

  SQLValueFunction(node: PG14.SQLValueFunction, context: TransformerContext): { SQLValueFunction: PG15.SQLValueFunction } {
    const result = this.transformGenericNode(node, context);
    return { SQLValueFunction: result };
  }

  GroupingFunc(node: PG14.GroupingFunc, context: TransformerContext): { GroupingFunc: PG15.GroupingFunc } {
    const result = this.transformGenericNode(node, context);
    return { GroupingFunc: result };
  }

  MultiAssignRef(node: PG14.MultiAssignRef, context: TransformerContext): { MultiAssignRef: PG15.MultiAssignRef } {
    const result = this.transformGenericNode(node, context);
    return { MultiAssignRef: result };
  }

  SetToDefault(node: PG14.SetToDefault, context: TransformerContext): { SetToDefault: PG15.SetToDefault } {
    const result = this.transformGenericNode(node, context);
    return { SetToDefault: result };
  }

  CurrentOfExpr(node: PG14.CurrentOfExpr, context: TransformerContext): { CurrentOfExpr: PG15.CurrentOfExpr } {
    const result = this.transformGenericNode(node, context);
    return { CurrentOfExpr: result };
  }

  TableLikeClause(node: PG14.TableLikeClause, context: TransformerContext): { TableLikeClause: PG15.TableLikeClause } {
    const result = this.transformGenericNode(node, context);
    return { TableLikeClause: result };
  }

  AlterFunctionStmt(node: PG14.AlterFunctionStmt, context: TransformerContext): { AlterFunctionStmt: PG15.AlterFunctionStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterFunctionStmt: result };
  }

  AlterObjectSchemaStmt(node: PG14.AlterObjectSchemaStmt, context: TransformerContext): { AlterObjectSchemaStmt: PG15.AlterObjectSchemaStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterObjectSchemaStmt: result };
  }

  AlterRoleSetStmt(node: PG14.AlterRoleSetStmt, context: TransformerContext): { AlterRoleSetStmt: PG15.AlterRoleSetStmt } {
    const result = this.transformGenericNode(node, context);
    return { AlterRoleSetStmt: result };
  }

  CreateForeignTableStmt(node: PG14.CreateForeignTableStmt, context: TransformerContext): { CreateForeignTableStmt: PG15.CreateForeignTableStmt } {
    const result = this.transformGenericNode(node, context);
    return { CreateForeignTableStmt: result };
  }

  // NOTE: this doesn't exist in v14?
  CreateAccessMethodStmt(node: any, context: TransformerContext): any {
    const result = this.transformGenericNode(node, context);
    return { CreateAccessMethodStmt: result };
  }
}
