#!/usr/bin/env node
/**
 * `pgsql-lint` — lint SQL source files for the convention rules.
 *
 *   pgsql-lint <path…> [--changed[=<base>]] [--ignore <globs>] [--rules a,b]
 *              [--warn a,b] [--off a,b] [--config <file>] [--json] [--quiet]
 *
 * Paths may be files or directories (directories are scanned recursively for
 * `.sql`), and default to `paths` from the config file. Exit code is 1 when any
 * *error*-severity finding remains, 0 otherwise — so it drops straight into a
 * pre-commit hook or CI step. Findings downgraded with `--warn` print but never
 * fail the run.
 */

import chalk from 'chalk';
import { existsSync } from 'fs';
import minimist from 'minimist';
import * as path from 'path';

import { changedSqlFiles } from './changed';
import { configDir, loadLintConfig } from './config';
import { FileFinding, lintFiles } from './file-runner';
import { LINT_RULES } from './rules';
import type { SeverityMap } from './types';

interface Argv {
  _: string[];
  changed?: string;
  ignore?: string | string[];
  rules?: string;
  warn?: string;
  off?: string;
  keyword?: string;
  config?: string;
  json?: boolean;
  quiet?: boolean;
  help?: boolean;
  version?: boolean;
}

const HELP = `pgsql-lint — source-level SQL/PL/pgSQL convention linter

Usage:
  pgsql-lint <path...> [options]

Arguments:
  path                 One or more .sql files or directories (scanned recursively).
                       Defaults to "paths" from the config file.

Options:
  --changed[=<base>]   Lint only .sql files that differ from <base> (default: the
                       PR base branch, else the repository default branch), using
                       the merge base, plus working-tree changes. Exits 0 when
                       nothing changed.
  --ignore <globs>     Exclude paths (comma-separated, repeatable).
  --rules <ids>        Comma-separated rule ids/codes to run (default: all).
  --warn <ids>         Report these rules as warnings (do not fail the run).
  --off <ids>          Disable these rules entirely.
  --keyword <kw>       Suppression directive keyword (default: pgsql-lint,safegres).
  --config <file>      Config file to use (default: nearest .pgsqllintrc.json).
  --no-config          Ignore any config file.
  --json               Emit findings as JSON.
  --quiet              Only print active findings (hide acknowledged waivers).
  -h, --help           Show this help.
  -v, --version        Show version.

Config file (.pgsqllintrc.json, discovered upward from cwd; flags override it):
  { "extends": "./base.json", "rules": [], "warn": [], "off": [],
    "ignore": ["sql/", "**/generated/**"], "keyword": [], "paths": ["packages"] }

Rules:
${LINT_RULES.map((r) => `  ${r.code}  ${r.id}  —  ${r.title}`).join('\n')}

Suppress inline (in the function body):
  -- pgsql-lint-disable-next-line no-dynamic-sql -- lookup-only: <why>
`;

function csv(v: string | string[] | undefined): string[] | undefined {
  if (v === undefined) return undefined;
  const parts = (Array.isArray(v) ? v : [v])
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

/**
 * `--changed` takes an *optional* value, which minimist cannot express: with
 * `string: ['changed']` it would swallow a following path. Bind the next token
 * only when it is not a flag and not an existing path — i.e. when it reads as a
 * git ref — and otherwise rewrite the flag to an empty value.
 */
function normalizeChanged(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--changed') {
      out.push(args[i]);
      continue;
    }
    const next = args[i + 1];
    if (next && !next.startsWith('-') && !existsSync(next)) {
      out.push(`--changed=${next}`);
      i++;
    } else {
      out.push('--changed=');
    }
  }
  return out;
}

async function main(): Promise<void> {
  const raw = process.argv.slice(2);
  // Handled here rather than as a minimist boolean: `config` also takes a value.
  const noConfig = raw.includes('--no-config');
  const argv = minimist(normalizeChanged(raw.filter((a) => a !== '--no-config')), {
    boolean: ['json', 'quiet', 'help', 'version'],
    string: ['rules', 'warn', 'off', 'keyword', 'changed', 'ignore', 'config'],
    alias: { h: 'help', v: 'version' }
  }) as unknown as Argv;

  if (argv.version) {
     
    console.log(require('../package.json').version);
    return;
  }

  const cwd = process.cwd();
  const loaded = noConfig
    ? { config: {} }
    : loadLintConfig({ cwd, configFile: argv.config || undefined });
  const fileConfig = loaded.config;
  const baseDir = configDir(loaded, cwd);

  const useChanged = argv.changed !== undefined;
  const paths =
    argv._.length > 0
      ? argv._
      : (fileConfig.paths ?? []).map((p) => path.resolve(baseDir, p));

  if (argv.help || (!useChanged && paths.length === 0)) {
    console.log(HELP);
    process.exit(argv.help ? 0 : 1);
  }

  const rules = csv(argv.rules) ?? fileConfig.rules;
  const keyword = csv(argv.keyword) ?? (fileConfig.keyword ? csv(fileConfig.keyword) : undefined);
  const ignore = csv(argv.ignore) ?? fileConfig.ignore;
  const severity: SeverityMap = {};
  for (const id of csv(argv.warn) ?? fileConfig.warn ?? []) severity[id] = 'warn';
  for (const id of csv(argv.off) ?? fileConfig.off ?? []) severity[id] = 'off';

  let targets: string[];
  if (useChanged) {
    const changed = changedSqlFiles({ cwd, base: argv.changed || undefined });
    // Nothing to lint is a pass, not an error — the common case on a branch
    // that touched no SQL at all.
    if (changed.files.length === 0) {
      if (argv.json) console.log('[]');
      else console.log(chalk.green('0 errors'), chalk.gray('(no changed .sql files)'));
      process.exit(0);
    }
    targets = paths.length > 0 ? withinPaths(changed.files, paths) : changed.files;
    if (targets.length === 0) {
      if (argv.json) console.log('[]');
      else console.log(chalk.green('0 errors'), chalk.gray('(no changed .sql files under the given paths)'));
      process.exit(0);
    }
  } else {
    targets = paths;
  }

  const reports = await lintFiles(targets, { rules, keyword, severity, ignore, cwd: baseDir });

  if (argv.json) {
    console.log(JSON.stringify(reports, null, 2));
  }

  let errors = 0;
  let warnings = 0;
  let acknowledged = 0;
  for (const report of reports) {
    if (report.parseError) {
      if (!argv.json) console.error(chalk.yellow(`⚠ ${report.file}: ${report.parseError}`));
      continue;
    }
    const shown = report.findings.filter((f) => !f.acknowledged || !argv.quiet);
    if (!argv.json && shown.length > 0) {
      console.log(chalk.underline(report.file));
      for (const f of shown) console.log(formatFinding(f));
      console.log('');
    }
    for (const f of report.findings) {
      if (f.acknowledged) acknowledged++;
      else if (f.severity === 'warn') warnings++;
      else errors++;
    }
  }

  if (!argv.json) {
    const parts: string[] = [];
    parts.push(errors > 0 ? chalk.red(`${errors} error${errors === 1 ? '' : 's'}`) : chalk.green('0 errors'));
    if (warnings > 0) parts.push(chalk.yellow(`${warnings} warning${warnings === 1 ? '' : 's'}`));
    if (acknowledged > 0) parts.push(chalk.gray(`${acknowledged} acknowledged`));
    console.log(parts.join(chalk.gray(', ')));
  }

  process.exit(errors > 0 ? 1 : 0);
}

/** Keep only changed files that sit inside one of the requested paths. */
function withinPaths(files: string[], paths: string[]): string[] {
  const roots = paths.map((p) => path.resolve(p));
  return files.filter((file) =>
    roots.some((root) => {
      if (file === root) return true;
      const rel = path.relative(root, file);
      return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
    })
  );
}

function formatFinding(f: FileFinding): string {
  const loc = chalk.gray(`${String(f.line).padStart(4)}`);
  const tag = f.acknowledged
    ? chalk.gray('acknowledged')
    : f.severity === 'warn'
      ? chalk.yellow(`${f.code} warn`)
      : chalk.red(`${f.code} error`);
  const id = chalk.gray(f.ruleId);
  let line = `  ${loc}  ${tag}  ${f.message}  ${id}  ${chalk.gray(f.subject)}`;
  if (f.acknowledged && f.reason) line += `\n        ${chalk.gray(`↳ waived (${f.scope}): ${f.reason}`)}`;
  else if (f.hint) line += `\n        ${chalk.gray(`↳ ${f.hint}`)}`;
  return line;
}

main().catch((err) => {
  console.error(chalk.red('Error:'), (err as Error).message || err);
  process.exit(2);
});
