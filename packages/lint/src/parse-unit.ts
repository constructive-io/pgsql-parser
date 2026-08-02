/**
 * Turn a `CREATE FUNCTION …` definition into a {@link LintUnit}: the parsed
 * SQL statement, the embedded body fragments, and the machinery to map any
 * AST location back to an absolute line in the original text.
 *
 * Line mapping is the whole trick. PL/pgSQL statement line numbers are
 * relative to the *body* (`prosrc`), and embedded SQL expressions are parsed
 * in isolation, so both have to be re-anchored to the definition text before a
 * finding — or a suppression comment — can be matched to them.
 */

import { parsePlPgSQL } from 'libpg-query';
import { parse } from 'pgsql-parser';

import type { DynamicSqlSite, LintUnit, SqlFragment } from './types';
import { findAll } from './walk';

/** Count newlines in `s[0..offset)` — i.e. how many lines precede `offset`. */
function newlinesBefore(s: string, offset: number): number {
  let n = 0;
  const end = Math.min(offset, s.length);
  for (let i = 0; i < end; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
}

/** Absolute 1-based line of a char offset within `text`. */
function lineOf(text: string, offset: number): number {
  return newlinesBefore(text, offset) + 1;
}

/** The body string of a `CreateFunctionStmt` (`AS $$ … $$`), or null. */
function functionBody(createFnStmt: Record<string, unknown>): string | null {
  const options = createFnStmt.options;
  if (!Array.isArray(options)) return null;
  for (const opt of options) {
    const de = (opt as Record<string, unknown>).DefElem as Record<string, unknown> | undefined;
    if (!de || de.defname !== 'as') continue;
    const arg = de.arg as Record<string, unknown> | undefined;
    const list = arg?.List as Record<string, unknown> | undefined;
    const items = list?.items;
    if (!Array.isArray(items) || items.length === 0) return null;
    // A two-item AS (`obj_file`, `link_symbol`) is a C function — no SQL body.
    if (items.length > 1) return null;
    const str = (items[0] as Record<string, unknown>).String as Record<string, unknown> | undefined;
    const sval = str?.sval;
    return typeof sval === 'string' ? sval : null;
  }
  return null;
}

/**
 * Walk the PL/pgSQL JSON tree, collecting (a) every embedded SQL expression
 * with the line number of its enclosing statement and (b) every dynamic-SQL
 * site. Line numbers here are body-relative; the caller re-anchors them.
 */
function collectPlpgsql(
  node: unknown,
  currentLine: number,
  exprs: Array<{ query: string; parseMode: number; line: number }>,
  dynamic: Array<{ line: number; form: string }>
): void {
  if (Array.isArray(node)) {
    for (const item of node) collectPlpgsql(item, currentLine, exprs, dynamic);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const rec = node as Record<string, unknown>;

  // A statement node carries its own line; descendants inherit it until the
  // next statement re-sets it.
  let line = currentLine;
  for (const [key, value] of Object.entries(rec)) {
    if (key.startsWith('PLpgSQL_stmt_')) {
      const stmt = value as Record<string, unknown>;
      if (typeof stmt.lineno === 'number') line = stmt.lineno;
      if (key === 'PLpgSQL_stmt_dynexecute') {
        dynamic.push({ line, form: 'EXECUTE' });
      } else if (key === 'PLpgSQL_stmt_dynfors') {
        dynamic.push({ line, form: 'FOR … IN EXECUTE' });
      }
    }
  }

  const expr = rec.PLpgSQL_expr as Record<string, unknown> | undefined;
  if (expr && typeof expr.query === 'string') {
    exprs.push({
      query: expr.query,
      parseMode: typeof expr.parseMode === 'number' ? expr.parseMode : 2,
      line
    });
  }

  for (const value of Object.values(rec)) collectPlpgsql(value, line, exprs, dynamic);
}

/** Reconstruct a parseable SQL string from a PL/pgSQL embedded expression. */
function fragmentSql(query: string, parseMode: number): string {
  // parseMode 0 = full statement; 3 = assignment (strip the anchored target so
  // the RHS parses); anything else is a bare expression.
  if (parseMode === 0) return query;
  let q = query;
  if (parseMode === 3) {
    q = q.replace(/^\s*[a-zA-Z_"][\w$".]*(\[[^\]]*\])*\s*:?=\s*/, '');
  }
  return `SELECT ${q}`;
}

/**
 * Parse a function definition into a {@link LintUnit}. Never throws: an
 * unparseable definition comes back with `parseError` set and no fragments,
 * so rules that need the AST simply find nothing.
 */
export async function parseUnit(
  text: string,
  language: string,
  name?: string
): Promise<LintUnit> {
  const lines = text.split('\n');
  const base: LintUnit = { text, lines, language, name, fragments: [], dynamicSql: [] };

  let sqlAst: unknown;
  try {
    sqlAst = await parse(text);
  } catch (err) {
    return { ...base, parseError: `definition failed to parse: ${(err as Error).message}` };
  }

  const createFnStmt = findAll(sqlAst, 'CreateFunctionStmt')[0];
  if (!createFnStmt) return { ...base, parseError: 'not a CREATE FUNCTION statement' };

  const body = functionBody(createFnStmt);
  const bodyOffset = body !== null ? text.indexOf(body) : -1;
  const bodyStartLine = bodyOffset >= 0 ? lineOf(text, bodyOffset) : undefined;

  const fragments: SqlFragment[] = [];
  const dynamicSql: DynamicSqlSite[] = [];

  const lang = language.toLowerCase();

  if (lang === 'sql' && body !== null && bodyStartLine !== undefined) {
    // A SQL-language body is itself SQL: parse it whole. Locations are
    // relative to the body, so re-anchor them onto the definition.
    try {
      const ast = await parse(body);
      fragments.push({
        ast,
        lineForOffset: (offset) => bodyStartLine + newlinesBefore(body, offset)
      });
    } catch {
      // Body may contain positional parameters etc. that don't parse alone —
      // leave it as no fragment rather than erroring the whole unit.
    }
  } else if (lang === 'plpgsql') {
    let plpgsql: unknown;
    try {
      plpgsql = await parsePlPgSQL(text);
    } catch (err) {
      return { ...base, createFnStmt, bodyStartLine, parseError: `PL/pgSQL body failed to parse: ${(err as Error).message}` };
    }
    const exprs: Array<{ query: string; parseMode: number; line: number }> = [];
    const dyn: Array<{ line: number; form: string }> = [];
    collectPlpgsql(plpgsql, 0, exprs, dyn);

    const anchor = (bodyLine: number): number =>
      bodyStartLine !== undefined && bodyLine > 0 ? bodyStartLine + (bodyLine - 1) : (bodyStartLine ?? 1);

    for (const d of dyn) dynamicSql.push({ line: anchor(d.line), form: d.form });

    for (const e of exprs) {
      const sql = fragmentSql(e.query, e.parseMode);
      let ast: unknown;
      try {
        ast = await parse(sql);
      } catch {
        continue; // opaque fragment — not the linter's concern
      }
      const absLine = anchor(e.line);
      fragments.push({ ast, lineForOffset: () => absLine });
    }
  }

  return { ...base, createFnStmt, bodyStartLine, fragments, dynamicSql };
}
