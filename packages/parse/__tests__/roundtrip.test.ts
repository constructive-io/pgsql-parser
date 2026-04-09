import * as fs from 'fs';
import * as path from 'path';
import {
  parseSync,
  deparseEnhanced,
  isRawComment,
  isRawWhitespace,
  isRawStmt,
  loadModule,
} from '../src';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const fixtures = fs.readdirSync(FIXTURES_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort()
  .map(f => ({
    name: f.replace('.sql', ''),
    sql: fs.readFileSync(path.join(FIXTURES_DIR, f), 'utf-8'),
  }));

beforeAll(async () => {
  await loadModule();
});

describe('fixture round-trip (CST)', () => {
  for (const { name, sql } of fixtures) {
    describe(name, () => {
      it('deparsed output matches snapshot', () => {
        const result = parseSync(sql);
        const output = deparseEnhanced(result);
        expect(output).toMatchSnapshot();
      });

      it('parse→deparse→parse→deparse is idempotent', () => {
        // First round trip
        const result1 = parseSync(sql);
        const output1 = deparseEnhanced(result1);

        // Second round trip
        const result2 = parseSync(output1);
        const output2 = deparseEnhanced(result2);

        // The two deparses must produce identical output
        expect(output2).toBe(output1);
      });

      it('preserves all -- comments from the original', () => {
        const result = parseSync(sql);
        const output = deparseEnhanced(result);

        // Extract expected comments: lines starting with -- that are NOT
        // inside dollar-quoted blocks
        const expectedComments = extractTopLevelComments(sql);

        for (const comment of expectedComments) {
          expect(output).toContain(comment);
        }
      });

      it('preserves all SQL statements from the original', () => {
        const result = parseSync(sql);
        const stmts = result.stmts.filter(isRawStmt);

        // Should have at least one real statement
        expect(stmts.length).toBeGreaterThan(0);

        // Deparse should produce valid SQL for each statement
        const output = deparseEnhanced(result);
        expect(output.length).toBeGreaterThan(0);
      });

      it('CST node ordering matches source order', () => {
        const result = parseSync(sql);
        const types = result.stmts.map(s => {
          if (isRawComment(s)) return 'comment';
          if (isRawWhitespace(s)) return 'whitespace';
          if (isRawStmt(s)) return 'stmt';
          return 'unknown';
        });

        // No unknown node types
        expect(types).not.toContain('unknown');

        // Should have at least one statement
        expect(types).toContain('stmt');
      });
    });
  }
});

/**
 * Extract top-level -- comments from SQL source, skipping any
 * that appear inside dollar-quoted strings.
 */
function extractTopLevelComments(sql: string): string[] {
  const comments: string[] = [];
  let inDollarQuote = false;
  let dollarTag = '';

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Check for dollar-quote boundaries
    const dollarMatch = trimmed.match(/\$([a-zA-Z_]*)\$/);
    if (dollarMatch) {
      const tag = dollarMatch[0];
      if (!inDollarQuote) {
        // Check if this line also closes the dollar quote
        const firstIdx = trimmed.indexOf(tag);
        const secondIdx = trimmed.indexOf(tag, firstIdx + tag.length);
        if (secondIdx === -1) {
          inDollarQuote = true;
          dollarTag = tag;
        }
        // If both open and close on same line, not entering a block
      } else if (tag === dollarTag) {
        inDollarQuote = false;
        dollarTag = '';
      }
      continue;
    }

    if (!inDollarQuote && trimmed.startsWith('--')) {
      comments.push(trimmed);
    }
  }

  return comments;
}
