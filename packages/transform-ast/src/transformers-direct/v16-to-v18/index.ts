import * as PG16 from '../../16/types';
import * as PG18 from '../../18/types';
import { V16ToV17Transformer } from '../../transformers/v16-to-v17';
import { V17ToV18Transformer } from '../../transformers/v17-to-v18';

/**
 * Direct transformer from PG16 to PG18
 * This transformer chains v16->...->v18 transformations
 */
export class PG16ToPG18Transformer {
  private v16to17 = new V16ToV17Transformer();
  private v17to18 = new V17ToV18Transformer();

  /**
   * Transform a node or parse result from PG16 to PG18
   * @param node - Can be a ParseResult or any Node type
   */
  transform(node: PG16.Node): PG18.Node;
  transform(node: PG16.ParseResult): PG18.ParseResult;
  transform(node: PG16.Node | PG16.ParseResult): PG18.Node | PG18.ParseResult {
    if (this.isParseResult(node)) {
      // Transform through the chain: v16->v17->v18
      const v17Stmts = node.stmts.map((stmtWrapper: any) => {
        if (stmtWrapper.stmt) {
          const stmt = this.v16to17.transform(stmtWrapper.stmt, { parentNodeTypes: [] });
          return { ...stmtWrapper, stmt };
        }
        return stmtWrapper;
      });

      const v18Stmts = v17Stmts.map((stmtWrapper: any) => {
        if (stmtWrapper.stmt) {
          const stmt = this.v17to18.transform(stmtWrapper.stmt, { parentNodeTypes: [] });
          return { ...stmtWrapper, stmt };
        }
        return stmtWrapper;
      });

      return {
        ...node,
        version: 180004, // PG18 version
        stmts: v18Stmts
      } as PG18.ParseResult;
    }

    // Otherwise, transform as a regular node through the chain
    const v17Node = this.v16to17.transform(node as PG16.Node, { parentNodeTypes: [] });
    return this.v17to18.transform(v17Node, { parentNodeTypes: [] });
  }

  /**
   * Transform a single statement from PG16 to PG18
   * @deprecated Use transform() instead, which handles all node types
   */
  transformStatement(stmt: any): any {
    const v17Stmt = this.v16to17.transform(stmt, { parentNodeTypes: [] });
    return this.v17to18.transform(v17Stmt, { parentNodeTypes: [] });
  }

  /**
   * Type guard to check if a node is a ParseResult
   */
  private isParseResult(node: any): node is PG16.ParseResult {
    return node && typeof node === 'object' && 'version' in node && 'stmts' in node;
  }
}
