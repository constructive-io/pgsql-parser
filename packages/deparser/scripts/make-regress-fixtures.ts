#!/usr/bin/env ts-node
/**
 * Builds __fixtures__/regress/statements.json.gz from a libpg_query checkout:
 * the PostgreSQL regression SQL it vendors (test/sql/postgres_regress, plpgsql_regress)
 * plus its own test SQL (test/sql/deparse*, test/plpgsql_samples.sql).
 *
 *   npm run fixtures:regress -- /path/to/libpg_query
 *
 * Check out the libpg_query commit that the pinned libpg-query release was built from
 * (x-publish.libpgQueryCommit in libpg-query-node versions/18/package.json).
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import { sync as globSync } from 'glob';
import { loadModule, parseSync, scanSync } from 'libpg-query';
import * as path from 'path';
import * as zlib from 'zlib';

import { generateStatementKey } from './statement-splitter';

const OUT_FILE = path.join(__dirname, '../../../__fixtures__/regress/statements.json.gz');
const SOURCES = [
  'test/sql/postgres_regress/*.sql',
  'test/sql/plpgsql_regress/*.sql',
  'test/sql/deparse/*.sql',
  'test/sql/deparse-depesz/**/*.{sql,psql}',
  'test/plpgsql_samples.sql',
];

// Split on top-level semicolons using the real scanner, so string/dollar quoting and
// comments are handled. CREATE RULE (...; ...) and BEGIN ATOMIC ... END bodies stay whole.
function splitWithScanner(sql: string): string[] {
  const buf = Buffer.from(sql, 'utf8');
  const tokens = scanSync(sql).tokens;
  const out: string[] = [];
  let start = 0;
  let parens = 0;
  let atomic = 0;
  let cases = 0;
  let prev = '';
  for (const tok of tokens) {
    const word = tok.text.toUpperCase();
    if (tok.text === '(') parens++;
    else if (tok.text === ')') parens--;
    else if (word === 'ATOMIC' && prev === 'BEGIN') atomic++;
    else if (atomic > 0 && word === 'CASE') cases++;
    else if (atomic > 0 && word === 'END') {
      if (cases > 0) cases--;
      else atomic--;
    } else if (tok.text === ';' && parens === 0 && atomic === 0) {
      out.push(buf.subarray(start, tok.start).toString('utf8'));
      start = tok.end;
    }
    if (tok.tokenName !== 'SQL_COMMENT' && tok.tokenName !== 'C_COMMENT') prev = word;
  }
  out.push(buf.subarray(start).toString('utf8'));
  return out;
}

function splitStatements(sql: string): string[] {
  let pieces: string[];
  try {
    pieces = splitWithScanner(sql);
  } catch {
    // e.g. strings.sql has intentionally invalid escapes the scanner rejects
    pieces = sql.split(/;[ \t]*\r?\n/);
  }
  return pieces
    .map((s) => s.replace(/^(\s*--[^\n]*\n|\s+)+/, '').trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const root = path.resolve(process.argv[2] || process.env.LIBPG_QUERY_DIR || '');
  if (!fs.existsSync(path.join(root, 'test/sql/postgres_regress'))) {
    throw new Error('usage: npm run fixtures:regress -- /path/to/libpg_query');
  }
  await loadModule();
  const commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD']).toString().trim();
  const files = SOURCES.flatMap((pattern) => globSync(pattern, { cwd: root })).sort();
  const seen = new Set<string>();
  const statements: Record<string, string> = {};
  let skipped = 0;
  for (const rel of files) {
    const relKey = rel.replace(/^test\/(sql\/)?/, '').replace(/\.psql$/, '.sql');
    splitStatements(fs.readFileSync(path.join(root, rel), 'utf8')).forEach((sql, i) => {
      if (seen.has(sql)) return;
      seen.add(sql);
      try {
        if (!parseSync(sql).stmts?.length) return;
      } catch {
        skipped++;
        return;
      }
      statements[generateStatementKey(relKey, i)] = sql;
    });
  }
  const json = JSON.stringify({ libpgQueryCommit: commit, statements });
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, zlib.gzipSync(json, { level: 9 }));
  console.log(
    `${files.length} files, ${Object.keys(statements).length} statements (${skipped} unparseable skipped) ` +
      `-> ${path.relative(process.cwd(), OUT_FILE)} (${fs.statSync(OUT_FILE).size} bytes)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
