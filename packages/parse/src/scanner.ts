/**
 * Pure TypeScript scanner for extracting comments and vertical whitespace
 * from PostgreSQL SQL source text.
 *
 * Handles:
 * - Line comments: -- until end of line
 * - Block comments: /* ... *​/ with nesting
 * - String literals: '...' with '' escaping
 * - Dollar-quoted strings: $$...$$ and $tag$...$tag$
 * - Escape strings: E'...' with backslash escaping
 */

export interface ScannedComment {
  /** 'line' for -- comments, 'block' for /* comments */
  type: 'line' | 'block';
  /** The comment text (without delimiters) */
  text: string;
  /** Byte offset of the start of the comment (including delimiter) */
  start: number;
  /** Byte offset of the end of the comment (exclusive) */
  end: number;
}

export interface ScannedWhitespace {
  /** Number of blank lines (consecutive \n\n sequences) */
  lines: number;
  /** Byte offset of the start of the whitespace region */
  start: number;
  /** Byte offset of the end of the whitespace region */
  end: number;
}

export type ScannedElement = 
  | { kind: 'comment'; value: ScannedComment }
  | { kind: 'whitespace'; value: ScannedWhitespace };

/**
 * Scan SQL source text and extract all comments and significant
 * vertical whitespace (2+ consecutive newlines).
 *
 * This scanner correctly skips over string literals and
 * dollar-quoted strings so comments inside strings are ignored.
 */
export function scanComments(sql: string): ScannedElement[] {
  const elements: ScannedElement[] = [];
  let i = 0;
  const len = sql.length;

  while (i < len) {
    const ch = sql[i];

    // Line comment: --
    if (ch === '-' && i + 1 < len && sql[i + 1] === '-') {
      const start = i;
      i += 2;
      while (i < len && sql[i] !== '\n') {
        i++;
      }
      const text = sql.substring(start + 2, i);
      elements.push({
        kind: 'comment',
        value: { type: 'line', text, start, end: i }
      });
      continue;
    }

    // Block comment: /* ... */ with nesting
    if (ch === '/' && i + 1 < len && sql[i + 1] === '*') {
      const start = i;
      i += 2;
      let depth = 1;
      while (i < len && depth > 0) {
        if (sql[i] === '/' && i + 1 < len && sql[i + 1] === '*') {
          depth++;
          i += 2;
        } else if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      const text = sql.substring(start + 2, i - 2);
      elements.push({
        kind: 'comment',
        value: { type: 'block', text, start, end: i }
      });
      continue;
    }

    // String literal: '...' with '' escaping
    if (ch === '\'') {
      i++;
      while (i < len) {
        if (sql[i] === '\'') {
          if (i + 1 < len && sql[i + 1] === '\'') {
            i += 2; // escaped quote
          } else {
            i++; // closing quote
            break;
          }
        } else {
          i++;
        }
      }
      continue;
    }

    // Escape string: E'...' or e'...'
    if ((ch === 'E' || ch === 'e') && i + 1 < len && sql[i + 1] === '\'') {
      i += 2;
      while (i < len) {
        if (sql[i] === '\\') {
          i += 2; // skip escaped char
        } else if (sql[i] === '\'') {
          if (i + 1 < len && sql[i + 1] === '\'') {
            i += 2; // escaped quote
          } else {
            i++; // closing quote
            break;
          }
        } else {
          i++;
        }
      }
      continue;
    }

    // Dollar-quoted string: $$...$$ or $tag$...$tag$
    if (ch === '$') {
      const tagMatch = matchDollarTag(sql, i);
      if (tagMatch) {
        const tag = tagMatch;
        i += tag.length;
        // Find closing tag
        const closeIdx = sql.indexOf(tag, i);
        if (closeIdx >= 0) {
          i = closeIdx + tag.length;
        } else {
          // Unterminated — skip to end
          i = len;
        }
        continue;
      }
    }

    // Significant vertical whitespace: 2+ newlines in a row
    // (meaning at least one blank line between content)
    if (ch === '\n') {
      const start = i;
      let newlineCount = 0;
      let j = i;
      while (j < len && (sql[j] === '\n' || sql[j] === '\r' || sql[j] === ' ' || sql[j] === '\t')) {
        if (sql[j] === '\n') {
          newlineCount++;
        }
        j++;
      }
      if (newlineCount >= 2) {
        // This represents at least one blank line
        elements.push({
          kind: 'whitespace',
          value: { lines: newlineCount - 1, start, end: j }
        });
        i = j;
        continue;
      }
    }

    i++;
  }

  return elements;
}

/**
 * Try to match a dollar-quote tag at the given position.
 * Returns the full tag (e.g., '$$' or '$tag$') or null if not a dollar-quote.
 */
function matchDollarTag(sql: string, pos: number): string | null {
  if (sql[pos] !== '$') return null;
  
  // $$ case
  if (pos + 1 < sql.length && sql[pos + 1] === '$') {
    return '$$';
  }

  // $tag$ case: tag must be [a-zA-Z_][a-zA-Z0-9_]*
  let j = pos + 1;
  if (j < sql.length && /[a-zA-Z_]/.test(sql[j])) {
    j++;
    while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) {
      j++;
    }
    if (j < sql.length && sql[j] === '$') {
      return sql.substring(pos, j + 1);
    }
  }

  return null;
}
