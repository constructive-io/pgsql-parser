import * as PG15 from '../../15/types';
import * as PG18 from '../../18/types';
import { V15ToV16Transformer } from '../../transformers/v15-to-v16';
import { V16ToV17Transformer } from '../../transformers/v16-to-v17';
import { V17ToV18Transformer } from '../../transformers/v17-to-v18';

/**
 * Direct transformer from PG15 to PG18
 * This transformer chains v15->...->v18 transformations
 */
export class PG15ToPG18Transformer {
  private v15to16 = new V15ToV16Transformer();
  private v16to17 = new V16ToV17Transformer();
  private v17to18 = new V17ToV18Transformer();

  /**
   * Transform a node or parse result from PG15 to PG18
   * @param node - Can be a ParseResult or any Node type
   */
  transform(node: PG15.Node): PG18.Node;
  transform(node: PG15.ParseResult): PG18.ParseResult;
  transform(node: PG15.Node | PG15.ParseResult): PG18.Node | PG18.ParseResult {
    if (this.isParseResult(node)) {
      // Transform through the chain: v15->v16->v17->v18
      const v16Stmts = node.stmts.map((stmtWrapper: any) => {
        if (stmtWrapper.stmt) {
          const stmt = this.v15to16.transform(stmtWrapper.stmt, { parentNodeTypes: [] });
          return { ...stmtWrapper, stmt };
        }
        return stmtWrapper;
      });

      const v17Stmts = v16Stmts.map((stmtWrapper: any) => {
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
    const v16Node = this.v15to16.transform(node as PG15.Node, { parentNodeTypes: [] });
    const v17Node = this.v16to17.transform(v16Node, { parentNodeTypes: [] });
    return this.v17to18.transform(v17Node, { parentNodeTypes: [] });
  }

  /**
   * Transform a single statement from PG15 to PG18
   * @deprecated Use transform() instead, which handles all node types
   */
  transformStatement(stmt: any): any {
    const v16Stmt = this.v15to16.transform(stmt, { parentNodeTypes: [] });
    const v17Stmt = this.v16to17.transform(v16Stmt, { parentNodeTypes: [] });
    return this.v17to18.transform(v17Stmt, { parentNodeTypes: [] });
  }

  /**
   * Type guard to check if a node is a ParseResult
   */
  private isParseResult(node: any): node is PG15.ParseResult {
    return node && typeof node === 'object' && 'version' in node && 'stmts' in node;
  }
}
