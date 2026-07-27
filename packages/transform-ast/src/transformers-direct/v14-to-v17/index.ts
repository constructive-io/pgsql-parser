import * as PG14 from '../../14/types';
import * as PG17 from '../../17/types';
import { V14ToV15Transformer } from '../../transformers/v14-to-v15';
import { V15ToV16Transformer } from '../../transformers/v15-to-v16';
import { V16ToV17Transformer } from '../../transformers/v16-to-v17';

/**
 * Direct transformer from PG14 to PG17
 * This transformer chains v14->v15->v16->v17 transformations
 */
export class PG14ToPG17Transformer {
  private v14to15 = new V14ToV15Transformer();
  private v15to16 = new V15ToV16Transformer();
  private v16to17 = new V16ToV17Transformer();

  /**
   * Transform a node or parse result from PG14 to PG17
   * @param node - Can be a ParseResult or any Node type
   */
  transform(node: PG14.Node): PG17.Node;
  transform(node: PG14.ParseResult): PG17.ParseResult;
  transform(node: PG14.Node | PG14.ParseResult): PG17.Node | PG17.ParseResult {
    // If it's a ParseResult, handle it specially
    if (this.isParseResult(node)) {
      // Transform through the chain: v14->v15->v16->v17
      const v15Stmts = node.stmts.map((stmtWrapper: any) => {
        if (stmtWrapper.stmt) {
          const v15Stmt = this.v14to15.transform(stmtWrapper.stmt, { parentNodeTypes: [] });
          return { ...stmtWrapper, stmt: v15Stmt };
        }
        return stmtWrapper;
      });

      const v16Stmts = v15Stmts.map((stmtWrapper: any) => {
        if (stmtWrapper.stmt) {
          const v16Stmt = this.v15to16.transform(stmtWrapper.stmt, { parentNodeTypes: [] });
          return { ...stmtWrapper, stmt: v16Stmt };
        }
        return stmtWrapper;
      });

      const v17Stmts = v16Stmts.map((stmtWrapper: any) => {
        if (stmtWrapper.stmt) {
          const v17Stmt = this.v16to17.transform(stmtWrapper.stmt, { parentNodeTypes: [] });
          return { ...stmtWrapper, stmt: v17Stmt };
        }
        return stmtWrapper;
      });

      return {
        ...node,
        version: 170004, // PG17 version
        stmts: v17Stmts
      } as PG17.ParseResult;
    }

    // Otherwise, transform as a regular node through the chain
    const v15Node = this.v14to15.transform(node as PG14.Node, { parentNodeTypes: [] });
    const v16Node = this.v15to16.transform(v15Node, { parentNodeTypes: [] });
    return this.v16to17.transform(v16Node, { parentNodeTypes: [] });
  }

  /**
   * Transform a single statement from PG14 to PG17
   * @deprecated Use transform() instead, which handles all node types
   */
  transformStatement(stmt: any): any {
    const v15Stmt = this.v14to15.transform(stmt, { parentNodeTypes: [] });
    const v16Stmt = this.v15to16.transform(v15Stmt, { parentNodeTypes: [] });
    return this.v16to17.transform(v16Stmt, { parentNodeTypes: [] });
  }

  /**
   * Type guard to check if a node is a ParseResult
   */
  private isParseResult(node: any): node is PG14.ParseResult {
    return node && typeof node === 'object' && 'version' in node && 'stmts' in node;
  }
}