import * as PG16 from '../../16/types';
import * as PG17 from '../../17/types';
import { V16ToV17Transformer } from '../../transformers/v16-to-v17';

/**
 * Direct transformer from PG16 to PG17
 * This transformer only includes the necessary code for v16->v17 transformation
 */
export class PG16ToPG17Transformer {
  private transformer = new V16ToV17Transformer();

  /**
   * Transform a node or parse result from PG16 to PG17
   * @param node - Can be a ParseResult or any Node type
   */
  transform(node: PG16.Node): PG17.Node;
  transform(node: PG16.ParseResult): PG17.ParseResult;
  transform(node: PG16.Node | PG16.ParseResult): PG17.Node | PG17.ParseResult {
    // If it's a ParseResult, handle it specially
    if (this.isParseResult(node)) {
      const transformedStmts = node.stmts.map((stmtWrapper: any) => {
        if (stmtWrapper.stmt) {
          const transformedStmt = this.transformer.transform(stmtWrapper.stmt, { parentNodeTypes: [] });
          return { ...stmtWrapper, stmt: transformedStmt };
        }
        return stmtWrapper;
      });

      return {
        ...node,
        version: 170004, // PG17 version
        stmts: transformedStmts
      } as PG17.ParseResult;
    }

    // Otherwise, transform as a regular node
    return this.transformer.transform(node as PG16.Node, { parentNodeTypes: [] });
  }

  /**
   * Transform a single statement from PG16 to PG17
   * @deprecated Use transform() instead, which handles all node types
   */
  transformStatement(stmt: any): any {
    return this.transformer.transform(stmt, { parentNodeTypes: [] });
  }

  /**
   * Type guard to check if a node is a ParseResult
   */
  private isParseResult(node: any): node is PG16.ParseResult {
    return node && typeof node === 'object' && 'version' in node && 'stmts' in node;
  }
}