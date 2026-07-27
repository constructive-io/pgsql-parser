import { Parser } from '@pgsql/parser';
import { 
  PG13ToPG17Transformer,
  PG14ToPG17Transformer,
  PG15ToPG17Transformer,
  PG16ToPG17Transformer
} from '../src/transformers-direct';

describe('Direct Transformers', () => {
  const testSQL = 'SELECT id, name FROM users WHERE active = true';

  describe('PG16ToPG17Transformer', () => {
    it('should transform PG16 ParseResult to PG17', async () => {
      const pg16Parser = new Parser({ version: 16 });
      
      const pg16Ast = await pg16Parser.parse(testSQL);
      const transformer = new PG16ToPG17Transformer();
      const transformedAst = transformer.transform(pg16Ast);
      
      expect(transformedAst.version).toBe(170004);
      expect(transformedAst.stmts).toBeDefined();
      expect(transformedAst.stmts.length).toBe(1);
      
      // Verify the structure is preserved
      expect(transformedAst.stmts[0].stmt).toBeDefined();
      const stmt = transformedAst.stmts[0].stmt as any;
      expect(stmt.SelectStmt).toBeDefined();
    });

    it('should transform PG16 Node to PG17', async () => {
      const pg16Parser = new Parser({ version: 16 });
      
      const pg16Ast = await pg16Parser.parse(testSQL);
      const transformer = new PG16ToPG17Transformer();
      
      // Transform just the statement node
      const stmtNode = pg16Ast.stmts[0].stmt;
      const transformedNode = transformer.transform(stmtNode);
      
      // Verify the node was transformed
      expect(transformedNode).toBeDefined();
      expect((transformedNode as any).SelectStmt).toBeDefined();
    });
  });

  describe('PG15ToPG17Transformer', () => {
    it('should transform PG15 ParseResult to PG17', async () => {
      const pg15Parser = new Parser({ version: 15 });
      
      const pg15Ast = await pg15Parser.parse(testSQL);
      const transformer = new PG15ToPG17Transformer();
      const transformedAst = transformer.transform(pg15Ast);
      
      expect(transformedAst.version).toBe(170004);
      expect(transformedAst.stmts).toBeDefined();
      expect(transformedAst.stmts.length).toBe(1);
      
      // Verify the structure is preserved
      expect(transformedAst.stmts[0].stmt).toBeDefined();
      const stmt = transformedAst.stmts[0].stmt as any;
      expect(stmt.SelectStmt).toBeDefined();
    });

    it('should transform PG15 Node to PG17', async () => {
      const pg15Parser = new Parser({ version: 15 });
      
      const pg15Ast = await pg15Parser.parse(testSQL);
      const transformer = new PG15ToPG17Transformer();
      
      // Transform just the statement node
      const stmtNode = pg15Ast.stmts[0].stmt;
      const transformedNode = transformer.transform(stmtNode);
      
      // Verify the node was transformed
      expect(transformedNode).toBeDefined();
      expect((transformedNode as any).SelectStmt).toBeDefined();
    });
  });

  describe('PG14ToPG17Transformer', () => {
    it('should transform PG14 ParseResult to PG17', async () => {
      const pg14Parser = new Parser({ version: 14 });
      
      const pg14Ast = await pg14Parser.parse(testSQL);
      const transformer = new PG14ToPG17Transformer();
      const transformedAst = transformer.transform(pg14Ast);
      
      expect(transformedAst.version).toBe(170004);
      expect(transformedAst.stmts).toBeDefined();
      expect(transformedAst.stmts.length).toBe(1);
      
      // Verify the structure is preserved
      expect(transformedAst.stmts[0].stmt).toBeDefined();
      const stmt = transformedAst.stmts[0].stmt as any;
      expect(stmt.SelectStmt).toBeDefined();
    });

    it('should transform PG14 Node to PG17', async () => {
      const pg14Parser = new Parser({ version: 14 });
      
      const pg14Ast = await pg14Parser.parse(testSQL);
      const transformer = new PG14ToPG17Transformer();
      
      // Transform just the statement node
      const stmtNode = pg14Ast.stmts[0].stmt;
      const transformedNode = transformer.transform(stmtNode);
      
      // Verify the node was transformed
      expect(transformedNode).toBeDefined();
      expect((transformedNode as any).SelectStmt).toBeDefined();
    });
  });

  describe('PG13ToPG17Transformer', () => {
    it('should transform PG13 ParseResult to PG17', async () => {
      const pg13Parser = new Parser({ version: 13 });
      
      const pg13Ast = await pg13Parser.parse(testSQL);
      const transformer = new PG13ToPG17Transformer();
      const transformedAst = transformer.transform(pg13Ast);
      
      expect(transformedAst.version).toBe(170004);
      expect(transformedAst.stmts).toBeDefined();
      expect(transformedAst.stmts.length).toBe(1);
      
      // Verify the structure is preserved
      expect(transformedAst.stmts[0].stmt).toBeDefined();
      const stmt = transformedAst.stmts[0].stmt as any;
      expect(stmt.SelectStmt).toBeDefined();
    });

    it('should transform PG13 Node to PG17', async () => {
      const pg13Parser = new Parser({ version: 13 });
      
      const pg13Ast = await pg13Parser.parse(testSQL);
      const transformer = new PG13ToPG17Transformer();
      
      // Transform just the statement node
      const stmtNode = pg13Ast.stmts[0].stmt;
      const transformedNode = transformer.transform(stmtNode);
      
      // Verify the node was transformed
      expect(transformedNode).toBeDefined();
      expect((transformedNode as any).SelectStmt).toBeDefined();
    });
  });

  describe('Complex node transformations', () => {
    it('should transform nested nodes', async () => {
      const complexSQL = `
        WITH active_users AS (
          SELECT * FROM users WHERE active = true
        )
        SELECT id, name FROM active_users
        ORDER BY name
        LIMIT 10
      `;
      
      const pg15Parser = new Parser({ version: 15 });
      const pg15Ast = await pg15Parser.parse(complexSQL);
      const transformer = new PG15ToPG17Transformer();
      
      // Transform the entire AST
      const transformedAst = transformer.transform(pg15Ast);
      expect(transformedAst.version).toBe(170004);
      
      // Transform just a nested node (the WITH clause)
      const selectStmt = pg15Ast.stmts[0].stmt as any;
      const withClause = selectStmt.SelectStmt.withClause;
      if (withClause) {
        const transformedWith = transformer.transform(withClause);
        expect(transformedWith).toBeDefined();
      }
    });
  });

  describe('Error handling', () => {
    it('should handle null/undefined gracefully', () => {
      const transformer = new PG16ToPG17Transformer();
      
      expect(() => transformer.transform(null as any)).not.toThrow();
      expect(() => transformer.transform(undefined as any)).not.toThrow();
    });

    it('should handle invalid nodes', () => {
      const transformer = new PG16ToPG17Transformer();
      const invalidNode = { someRandomProp: 'value' };
      
      // Should not throw, but return transformed node
      const result = transformer.transform(invalidNode as any);
      expect(result).toBeDefined();
    });
  });
});