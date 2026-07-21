import * as PG17 from '../../17/types';
import * as PG18 from '../../18/types';
import { V17ToV18Transformer } from '../../transformers/v17-to-v18';

/**
 * Direct transformer from PG17 to PG18
 * This transformer chains v17->...->v18 transformations
 */
export class PG17ToPG18Transformer {
  private v17to18 = new V17ToV18Transformer();

  /**
   * Transform a node or parse result from PG17 to PG18
   * @param node - Can be a ParseResult or any Node type
   */
  transform(node: PG17.Node): PG18.Node;
  transform(node: PG17.ParseResult): PG18.ParseResult;
  transform(node: PG17.Node | PG17.ParseResult): PG18.Node | PG18.ParseResult {
    if (this.isParseResult(node)) {
      const transformedStmts = node.stmts.map((stmtWrapper: any) => {
        if (stmtWrapper.stmt) {
          const transformedStmt = this.v17to18.transform(stmtWrapper.stmt, { parentNodeTypes: [] });
          return { ...stmtWrapper, stmt: transformedStmt };
        }
        return stmtWrapper;
      });

      return {
        ...node,
        version: 180004, // PG18 version
        stmts: transformedStmts
      } as PG18.ParseResult;
    }

    // Otherwise, transform as a regular node
    return this.v17to18.transform(node as PG17.Node, { parentNodeTypes: [] });
  }

  /**
   * Transform a single statement from PG17 to PG18
   * @deprecated Use transform() instead, which handles all node types
   */
  transformStatement(stmt: any): any {
    return this.v17to18.transform(stmt, { parentNodeTypes: [] });
  }

  /**
   * Type guard to check if a node is a ParseResult
   */
  private isParseResult(node: any): node is PG17.ParseResult {
    return node && typeof node === 'object' && 'version' in node && 'stmts' in node;
  }
}
