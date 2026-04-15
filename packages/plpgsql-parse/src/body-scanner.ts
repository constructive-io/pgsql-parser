/**
 * Scanner for extracting comments from PL/pgSQL function bodies.
 *
 * Uses simple line-based scanning since the body text has already been
 * extracted from the dollar-quoted string — no need to worry about
 * string literal boundaries at this level.
 */

import type { BodyComment } from './types';

/**
 * Scan a PL/pgSQL function body for -- line comments.
 *
 * Returns an array of BodyComment objects ordered by line number.
 * Only detects standalone comment lines (lines where the first
 * non-whitespace content is --). Inline trailing comments on code
 * lines are not extracted since the PL/pgSQL deparser cannot
 * reconstruct them at the right position.
 */
export function scanBodyComments(body: string): BodyComment[] {
  const lines = body.split('\n');
  const comments: BodyComment[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('--')) {
      comments.push({
        text: trimmed,
        lineNo: i + 1, // 1-based
        standalone: true,
      });
    }
  }

  return comments;
}

/**
 * A comment group: one or more consecutive comment lines
 * associated with the code that follows them.
 */
export interface CommentGroup {
  /** The comment lines (trimmed, with -- prefix) */
  comments: string[];
  /**
   * The lineno of the PL/pgSQL statement this group precedes.
   * null if the comments are at the end of the body (after all statements).
   */
  anchorLineno: number | null;
}

/**
 * Associate body comments with PL/pgSQL statement line numbers.
 *
 * For each comment, finds the first statement whose lineno is greater
 * than the comment's line number. Groups consecutive comments together.
 *
 * @param comments - Comments extracted by scanBodyComments
 * @param stmtLinenos - Sorted array of statement lineno values from the PL/pgSQL AST
 */
export function groupCommentsByAnchor(
  comments: BodyComment[],
  stmtLinenos: number[]
): CommentGroup[] {
  if (comments.length === 0) return [];

  const groups: CommentGroup[] = [];
  let currentGroup: string[] = [];
  let lastLineNo = -1;

  for (const comment of comments) {
    // Start a new group if there's a gap (non-consecutive lines)
    if (lastLineNo >= 0 && comment.lineNo > lastLineNo + 1) {
      if (currentGroup.length > 0) {
        const anchor = findAnchorLineno(lastLineNo, stmtLinenos);
        groups.push({ comments: [...currentGroup], anchorLineno: anchor });
        currentGroup = [];
      }
    }
    currentGroup.push(comment.text);
    lastLineNo = comment.lineNo;
  }

  // Flush remaining group
  if (currentGroup.length > 0) {
    const anchor = findAnchorLineno(lastLineNo, stmtLinenos);
    groups.push({ comments: [...currentGroup], anchorLineno: anchor });
  }

  return groups;
}

/**
 * Find the first statement lineno that comes after the given line number.
 */
function findAnchorLineno(afterLine: number, stmtLinenos: number[]): number | null {
  for (const lineno of stmtLinenos) {
    if (lineno > afterLine) {
      return lineno;
    }
  }
  return null;
}
