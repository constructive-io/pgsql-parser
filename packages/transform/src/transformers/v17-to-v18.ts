import * as PG17 from '../17/types';
import * as PG18 from '../18/types';
import { TransformerContext } from './context';

/**
 * V17 to V18 AST Transformer
 * Transforms PostgreSQL v17 AST nodes to v18 format
 *
 * Structural changes in v18:
 * - InsertStmt/UpdateStmt/DeleteStmt/MergeStmt: returningList -> returningClause { exprs }
 * - Constraint: new is_enforced flag (true by default for CHECK/FOREIGN/NOTNULL)
 * - Constraint: CONSTR_GENERATED gains generated_kind ('s' = STORED, 'v' = VIRTUAL)
 * - Column-level NOT NULL constraints gain initially_valid: true
 */
export class V17ToV18Transformer {

  transform(node: PG17.Node, context: TransformerContext = { parentNodeTypes: [] }): any {
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

  visit(node: PG17.Node, context: TransformerContext = { parentNodeTypes: [] }): any {
    if (node && typeof node === 'object' && 'version' in node && 'stmts' in node) {
      return this.ParseResult(node as unknown as PG17.ParseResult, context);
    }

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

    // No specific method: recurse into children so nested statements
    // (e.g. DML inside CTEs) still get transformed
    return this.walkValue(node, context);
  }

  /**
   * Generic recursive walk that re-dispatches wrapped nodes with a
   * dedicated transformer method and deep-copies everything else.
   */
  private walkValue(value: any, context: TransformerContext): any {
    if (value == null || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.walkValue(item, context));
    }

    const keys = Object.keys(value);
    if (keys.length === 1 && typeof (this as any)[keys[0]] === 'function') {
      // Wrapped node with a dedicated transformer method
      return this.visit(value as PG17.Node, context);
    }

    const result: any = {};
    for (const key of keys) {
      result[key] = this.walkValue(value[key], context);
    }
    return result;
  }

  getNodeType(node: PG17.Node): any {
    return Object.keys(node)[0];
  }

  getNodeData(node: PG17.Node): any {
    const keys = Object.keys(node);
    if (keys.length === 1 && typeof (node as any)[keys[0]] === 'object') {
      return (node as any)[keys[0]];
    }
    return node;
  }

  ParseResult(node: PG17.ParseResult, context: TransformerContext): PG18.ParseResult {

    if (node && typeof node === 'object' && 'version' in node && 'stmts' in node) {
      return {
        version: 180004, // PG18 version
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

    return node as unknown as PG18.ParseResult;
  }

  RawStmt(node: PG17.RawStmt, context: TransformerContext): { RawStmt: PG18.RawStmt } {
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

  /**
   * Convert a v17 returningList into a v18 ReturningClause
   */
  private transformReturningList(returningList: PG17.Node[], context: TransformerContext): PG18.ReturningClause {
    return {
      exprs: returningList.map(item => this.transform(item as any, context))
    };
  }

  private transformDmlStatement(nodeType: string, node: any, context: TransformerContext): any {
    const result: any = {};

    for (const key of Object.keys(node)) {
      if (key === 'returningList') {
        result.returningClause = this.transformReturningList(node.returningList, context);
      } else {
        result[key] = this.walkValue(node[key], context);
      }
    }

    return { [nodeType]: result };
  }

  InsertStmt(node: PG17.InsertStmt, context: TransformerContext): { InsertStmt: PG18.InsertStmt } {
    return this.transformDmlStatement('InsertStmt', node, context);
  }

  UpdateStmt(node: PG17.UpdateStmt, context: TransformerContext): { UpdateStmt: PG18.UpdateStmt } {
    return this.transformDmlStatement('UpdateStmt', node, context);
  }

  DeleteStmt(node: PG17.DeleteStmt, context: TransformerContext): { DeleteStmt: PG18.DeleteStmt } {
    return this.transformDmlStatement('DeleteStmt', node, context);
  }

  MergeStmt(node: PG17.MergeStmt, context: TransformerContext): { MergeStmt: PG18.MergeStmt } {
    return this.transformDmlStatement('MergeStmt', node, context);
  }

  AlterTableCmd(node: PG17.AlterTableCmd, context: TransformerContext): { AlterTableCmd: PG18.AlterTableCmd } {
    const result: any = {};

    for (const key of Object.keys(node)) {
      result[key] = this.walkValue((node as any)[key], context);
    }

    // v18 wraps ALTER CONSTRAINT definitions in the new ATAlterConstraint node
    if (node.subtype === 'AT_AlterConstraint' && (node.def as any)?.Constraint) {
      const constraint = (node.def as any).Constraint;
      const alterConstraint: any = {};
      if (constraint.conname !== undefined) {
        alterConstraint.conname = constraint.conname;
      }
      alterConstraint.is_enforced = true;
      // v17 ALTER CONSTRAINT could only change deferrability
      alterConstraint.alterDeferrability = true;
      if (constraint.deferrable !== undefined) {
        alterConstraint.deferrable = constraint.deferrable;
      }
      if (constraint.initdeferred !== undefined) {
        alterConstraint.initdeferred = constraint.initdeferred;
      }
      result.def = { ATAlterConstraint: alterConstraint };
    }

    return { AlterTableCmd: result };
  }

  VariableSetStmt(node: PG17.VariableSetStmt, context: TransformerContext): { VariableSetStmt: PG18.VariableSetStmt } {
    const result: any = {};

    for (const key of Object.keys(node)) {
      result[key] = this.walkValue((node as any)[key], context);
    }

    // v18 marks SET TRANSACTION / SESSION CHARACTERISTICS args as jumbled
    if (node.kind === 'VAR_SET_MULTI' && (node.name === 'TRANSACTION' || node.name === 'SESSION CHARACTERISTICS')) {
      result.jumble_args = true;
    }

    return { VariableSetStmt: result };
  }

  Constraint(node: PG17.Constraint, context: TransformerContext): { Constraint: PG18.Constraint } {
    const result: any = {};

    for (const key of Object.keys(node)) {
      result[key] = this.walkValue((node as any)[key], context);
    }

    // v18 constraints are enforced by default; v17 grammar had no ENFORCED syntax
    if (node.contype === 'CONSTR_CHECK' || node.contype === 'CONSTR_FOREIGN') {
      result.is_enforced = true;
    }

    if (node.contype === 'CONSTR_NOTNULL') {
      // v17 only produces column-level NOT NULL constraints, which in v18
      // carry is_enforced and initially_valid
      result.is_enforced = true;
      result.initially_valid = true;
    }

    if (node.contype === 'CONSTR_GENERATED' && result.generated_kind === undefined) {
      // v17 only supports STORED generated columns
      result.generated_kind = 's';
    }

    return { Constraint: result };
  }
}
