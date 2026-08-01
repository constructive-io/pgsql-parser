import * as t from '@pgsql/types';
import { parse } from 'libpg-query';

import { Deparser } from '../src/deparser';

describe('Entry Point Refactoring', () => {
  const sql = `
    SELECT * FROM users WHERE id = 1;
    INSERT INTO logs (message) VALUES ('test');
  `;

  let parseResult: t.ParseResult;

  beforeAll(async () => {
    parseResult = await parse(sql);
  });

  describe('ParseResult handling', () => {
    it('should handle bare ParseResult (duck-typed)', () => {
      const result = Deparser.deparse(parseResult, { pretty: false });
      expect(result).toContain('SELECT * FROM users WHERE id = 1');
      expect(result).toContain('INSERT INTO logs (message) VALUES (\'test\')');
    });

    it('should handle wrapped ParseResult', () => {
      const wrappedParseResult = { ParseResult: parseResult } as t.Node;
      const result = Deparser.deparse(wrappedParseResult, { pretty: false });
      expect(result).toContain('SELECT * FROM users WHERE id = 1');
      expect(result).toContain('INSERT INTO logs (message) VALUES (\'test\')');
    });

    it('should preserve semicolons based on stmt_len', () => {
      const result = Deparser.deparse(parseResult, { pretty: false });
      // The first statement should have a semicolon if stmt_len is set
      const lines = result.split('\n').filter(line => line.trim());
      if (parseResult.stmts?.[0]?.stmt_len) {
        expect(lines[0]).toMatch(/;$/);
      }
    });
  });

  describe('RawStmt handling', () => {
    it('should handle wrapped RawStmt', () => {
      const rawStmt = parseResult.stmts![0];
      const wrappedRawStmt = { RawStmt: rawStmt } as t.Node;
      const result = Deparser.deparse(wrappedRawStmt, { pretty: false });
      expect(result).toContain('SELECT * FROM users WHERE id = 1');
    });

    it('should add semicolon when stmt_len is present', () => {
      const rawStmt = parseResult.stmts![0];
      if (rawStmt.stmt_len) {
        const wrappedRawStmt = { RawStmt: rawStmt } as t.Node;
        const result = Deparser.deparse(wrappedRawStmt, { pretty: false });
        expect(result).toMatch(/;$/);
      }
    });
  });

  describe('Array handling', () => {
    it('should handle array of statements', () => {
      const statements = parseResult.stmts!.map(rawStmt => rawStmt.stmt!);
      const result = Deparser.deparse(statements, { pretty: false });
      expect(result).toContain('SELECT * FROM users WHERE id = 1');
      expect(result).toContain('INSERT INTO logs (message) VALUES (\'test\')');
    });

    it('should handle array of wrapped nodes', () => {
      const wrappedNodes = parseResult.stmts!.map(rawStmt => ({ RawStmt: rawStmt } as t.Node));
      const result = Deparser.deparse(wrappedNodes, { pretty: false });
      expect(result).toContain('SELECT * FROM users WHERE id = 1');
      expect(result).toContain('INSERT INTO logs (message) VALUES (\'test\')');
    });
  });

  describe('Single node handling', () => {
    it('should handle single statement', () => {
      const stmt = parseResult.stmts![0].stmt!;
      const result = Deparser.deparse(stmt, { pretty: false });
      expect(result).toContain('SELECT * FROM users WHERE id = 1');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty ParseResult', () => {
      const emptyParseResult: t.ParseResult = { stmts: [] };
      const result = Deparser.deparse(emptyParseResult);
      expect(result).toBe('');
    });

    it('should handle ParseResult with undefined stmts', () => {
      const parseResultNoStmts: t.ParseResult = {};
      const result = Deparser.deparse(parseResultNoStmts);
      expect(result).toBe('');
    });

    it('should handle RawStmt with undefined stmt', () => {
      const rawStmtNoStmt: t.RawStmt = {};
      const wrappedRawStmt = { RawStmt: rawStmtNoStmt } as t.Node;
      const result = Deparser.deparse(wrappedRawStmt);
      expect(result).toBe('');
    });

    it('should handle empty array', () => {
      const result = Deparser.deparse([]);
      expect(result).toBe('');
    });
  });

  describe('Type guards', () => {
    it('should correctly identify bare ParseResult', () => {
      const deparser = new Deparser(parseResult);
      // The tree should contain a wrapped ParseResult
      expect(deparser['tree'].length).toBe(1);
      const node = deparser['tree'][0];
      expect(node).toHaveProperty('ParseResult');
    });

    it('should not treat wrapped ParseResult as bare', () => {
      const wrapped = { ParseResult: parseResult } as t.Node;
      const deparser = new Deparser(wrapped);
      // The tree should contain the wrapped node as-is
      expect(deparser['tree'].length).toBe(1);
      expect(deparser['tree'][0]).toBe(wrapped);
    });
  });
});
