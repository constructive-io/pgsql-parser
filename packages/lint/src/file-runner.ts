/**
 * Run the linter over SQL *source files* — migrations, `CREATE FUNCTION`
 * scripts, anything on disk. This is the "local" entry point (CLI, pre-commit,
 * editor): it finds every function definition in a file, lints each one, and
 * re-anchors the findings to absolute file lines.
 *
 * The library entry point ({@link lintDefinition}) takes a single definition
 * as safegres feeds it from `pg_get_functiondef`; this layer adds the file
 * plumbing on top so a human or an agent can point it at `.sql` and get the
 * same findings without a database.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { parse } from 'pgsql-parser';

import { lintDefinition, LintOptions } from './engine';
import { applyIgnore } from './ignore';
import type {
  LintDefinitionInput,
  LintProblem,
  Severity,
  SourceAdapter,
  SuppressionScope
} from './types';
import { findAll } from './walk';

/** A finding re-anchored to a source file. */
export interface FileFinding {
  ruleId: string;
  /** Registry code, e.g. `C4`. */
  code: string;
  /** 1-based line within the file. */
  line: number;
  message: string;
  hint?: string;
  /** Configured severity (`error` by default; `warn` does not fail a run). */
  severity: Severity;
  /** The function it was found in, e.g. `app.grant_role`. */
  subject: string;
  /** True when a suppression comment acknowledged it (accepted risk, kept visible). */
  acknowledged: boolean;
  /** Waiver reason, when acknowledged and one was given. */
  reason?: string | null;
  /** Suppression scope, when acknowledged. */
  scope?: SuppressionScope;
  context?: Record<string, unknown>;
}

/** The result of linting one source file. */
export interface FileReport {
  file: string;
  findings: FileFinding[];
  /** A parse error on the whole file (not a single definition). */
  parseError?: string;
}

/** Count newlines before `offset` — the 0-based line the offset sits on. */
function lineAtOffset(text: string, offset: number): number {
  let n = 0;
  const end = Math.min(Math.max(offset, 0), text.length);
  for (let i = 0; i < end; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/** Printable `schema.name` of a `CreateFunctionStmt.funcname`. */
function funcName(createFnStmt: Record<string, unknown>): string {
  const funcname = createFnStmt.funcname;
  if (!Array.isArray(funcname)) return '<anonymous>';
  const parts = funcname
    .map((n) => {
      const str = (n as Record<string, unknown>).String as Record<string, unknown> | undefined;
      return str && typeof str.sval === 'string' ? str.sval : '';
    })
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts.join('.') : '<anonymous>';
}

/** The `LANGUAGE` of a `CreateFunctionStmt` (lower-cased), defaulting to `sql`. */
function funcLanguage(createFnStmt: Record<string, unknown>): string {
  const options = createFnStmt.options;
  if (Array.isArray(options)) {
    for (const opt of options) {
      const de = (opt as Record<string, unknown>).DefElem as Record<string, unknown> | undefined;
      if (de?.defname === 'language') {
        const str = (de.arg as Record<string, unknown> | undefined)?.String as
          | Record<string, unknown>
          | undefined;
        if (str && typeof str.sval === 'string') return str.sval.toLowerCase();
      }
    }
  }
  return 'sql';
}

/**
 * Split a SQL source string into the function definitions it contains. Each
 * `CREATE FUNCTION` is sliced back out with its absolute start line, so a
 * mixed migration (schema + tables + functions) yields one input per function
 * rather than being treated as a single malformed definition.
 */
export async function sqlTextDefinitions(
  source: string,
  file?: string
): Promise<LintDefinitionInput[]> {
  const parsed = (await parse(source)) as {
    stmts?: Array<{ stmt?: unknown; stmt_location?: number; stmt_len?: number }>;
  };
  const out: LintDefinitionInput[] = [];
  for (const entry of parsed.stmts ?? []) {
    const createFnStmt = entry.stmt ? findAll(entry.stmt, 'CreateFunctionStmt')[0] : undefined;
    if (!createFnStmt) continue;
    const start = entry.stmt_location ?? 0;
    const len = entry.stmt_len ?? source.length - start;
    out.push({
      text: source.slice(start, start + len),
      language: funcLanguage(createFnStmt),
      name: funcName(createFnStmt),
      file,
      startLine: lineAtOffset(source, start) // 0-based line the definition begins on
    });
  }
  return out;
}

/**
 * Lint a SQL source string that may contain many statements. Findings are
 * re-anchored to absolute lines within `source`.
 */
export async function lintSqlText(source: string, options: LintOptions = {}): Promise<FileReport> {
  let inputs: LintDefinitionInput[];
  try {
    inputs = await sqlTextDefinitions(source);
  } catch (err) {
    return { file: '<source>', findings: [], parseError: (err as Error).message };
  }
  const findings = await lintInputs(inputs, options);
  return { file: '<source>', findings };
}

/** Lint a set of adapter-produced definitions, re-anchored to file lines. */
async function lintInputs(
  inputs: LintDefinitionInput[],
  options: LintOptions
): Promise<FileFinding[]> {
  const findings: FileFinding[] = [];
  for (const input of inputs) {
    const subject = input.name ?? '<anonymous>';
    const startLine = input.startLine ?? 0;
    const { problems, suppressed } = await lintDefinition(
      input.text,
      input.language,
      subject,
      options
    );
    const absLine = (p: LintProblem): number => startLine + p.line; // p.line is 1-based within input.text
    for (const p of problems) findings.push(toFinding(p, subject, absLine(p), false));
    for (const s of suppressed) {
      findings.push(toFinding(s, subject, absLine(s), true, s.reason, s.scope));
    }
  }
  findings.sort((a, b) => a.line - b.line || a.ruleId.localeCompare(b.ruleId));
  return findings;
}

function toFinding(
  p: LintProblem,
  subject: string,
  line: number,
  acknowledged: boolean,
  reason?: string | null,
  scope?: SuppressionScope
): FileFinding {
  const meta: FileFinding = {
    ruleId: p.ruleId,
    code: codeFor(p.ruleId),
    line,
    message: p.message,
    severity: p.severity ?? 'error',
    subject,
    acknowledged,
    context: p.context
  };
  if (p.hint) meta.hint = p.hint;
  if (acknowledged) {
    meta.reason = reason ?? null;
    meta.scope = scope;
  }
  return meta;
}

const RULE_CODE: Record<string, string> = {
  'no-set-search-path': 'C1',
  'no-variable-conflict': 'C2',
  'require-qualified-refs': 'C3',
  'no-dynamic-sql': 'C4'
};
function codeFor(ruleId: string): string {
  return RULE_CODE[ruleId] ?? ruleId;
}

/** Recursively collect `.sql` files under a directory. */
async function sqlFilesUnder(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      out.push(...(await sqlFilesUnder(full)));
    } else if (e.isFile() && full.toLowerCase().endsWith('.sql')) {
      out.push(full);
    }
  }
  return out;
}

/** File-selection options layered on top of the lint options. */
export interface FileLintOptions extends LintOptions {
  /** Glob patterns to exclude (see `makeIgnoreFilter`). */
  ignore?: string[];
  /** Directory the `ignore` patterns are relative to (default `process.cwd()`). */
  cwd?: string;
}

/** Resolve a mix of file and directory paths to a sorted list of `.sql` files. */
export async function resolveSqlFiles(
  paths: string[],
  options: { ignore?: string[]; cwd?: string } = {}
): Promise<string[]> {
  const files = new Set<string>();
  for (const p of paths) {
    const st = await fs.stat(p);
    if (st.isDirectory()) {
      for (const f of await sqlFilesUnder(p)) files.add(f);
    } else if (st.isFile()) {
      files.add(p);
    }
  }
  return applyIgnore([...files].sort(), options.ignore, options.cwd);
}

/** Lint every `.sql` file reachable from `paths` (files or directories). */
export async function lintFiles(
  paths: string[],
  options: FileLintOptions = {}
): Promise<FileReport[]> {
  const files = await resolveSqlFiles(paths, { ignore: options.ignore, cwd: options.cwd });
  const reports: FileReport[] = [];
  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    const report = await lintSqlText(source, options);
    reports.push({ ...report, file });
  }
  return reports;
}

/** A {@link SourceAdapter} over an in-memory SQL string. */
export function sqlTextAdapter(source: string, file?: string): SourceAdapter {
  return { id: 'sql-text', definitions: () => sqlTextDefinitions(source, file) };
}

/** A {@link SourceAdapter} over `.sql` files/directories on disk. */
export function filesAdapter(
  paths: string[],
  options: { ignore?: string[]; cwd?: string } = {}
): SourceAdapter {
  return {
    id: 'files',
    definitions: async () => {
      const files = await resolveSqlFiles(paths, options);
      const out: LintDefinitionInput[] = [];
      for (const file of files) {
        out.push(...(await sqlTextDefinitions(await fs.readFile(file, 'utf8'), file)));
      }
      return out;
    }
  };
}

/**
 * Lint every definition an adapter yields, grouped into one {@link FileReport}
 * per origin file. This is the generic entry point: `@pgsql/lint` ships file
 * and sql-text adapters; a consumer (e.g. safegres over a live catalog) can
 * pass its own.
 */
export async function lintSource(
  adapter: SourceAdapter,
  options: LintOptions = {}
): Promise<FileReport[]> {
  const inputs = await adapter.definitions();
  const byFile = new Map<string, LintDefinitionInput[]>();
  for (const input of inputs) {
    const file = input.file ?? `<${adapter.id}>`;
    const arr = byFile.get(file) ?? [];
    arr.push(input);
    byFile.set(file, arr);
  }
  const reports: FileReport[] = [];
  for (const [file, group] of byFile) {
    reports.push({ file, findings: await lintInputs(group, options) });
  }
  reports.sort((a, b) => a.file.localeCompare(b.file));
  return reports;
}
