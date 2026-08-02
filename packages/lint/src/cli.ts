#!/usr/bin/env node
/**
 * `pgsql-lint` — lint SQL source files for the convention rules.
 *
 *   pgsql-lint <path…> [--rules a,b] [--warn a,b] [--off a,b] [--json] [--quiet]
 *
 * Paths may be files or directories (directories are scanned recursively for
 * `.sql`). Exit code is 1 when any *error*-severity finding remains, 0
 * otherwise — so it drops straight into a pre-commit hook or CI step. Findings
 * downgraded with `--warn` print but never fail the run.
 */

import chalk from 'chalk';
import minimist from 'minimist';

import { FileFinding, lintFiles } from './file-runner';
import { LINT_RULES } from './rules';
import type { SeverityMap } from './types';

interface Argv {
  _: string[];
  rules?: string;
  warn?: string;
  off?: string;
  keyword?: string;
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

Options:
  --rules <ids>        Comma-separated rule ids/codes to run (default: all).
  --warn <ids>         Report these rules as warnings (do not fail the run).
  --off <ids>          Disable these rules entirely.
  --keyword <kw>       Suppression directive keyword (default: pgsql-lint,safegres).
  --json               Emit findings as JSON.
  --quiet              Only print active findings (hide acknowledged waivers).
  -h, --help           Show this help.
  -v, --version        Show version.

Rules:
${LINT_RULES.map((r) => `  ${r.code}  ${r.id}  —  ${r.title}`).join('\n')}

Suppress inline (in the function body):
  -- pgsql-lint-disable-next-line no-dynamic-sql -- lookup-only: <why>
`;

function csv(v: string | undefined): string[] | undefined {
  if (!v) return undefined;
  const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

async function main(): Promise<void> {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['json', 'quiet', 'help', 'version'],
    string: ['rules', 'warn', 'off', 'keyword'],
    alias: { h: 'help', v: 'version' }
  }) as unknown as Argv;

  if (argv.version) {
     
    console.log(require('../package.json').version);
    return;
  }
  if (argv.help || argv._.length === 0) {
    console.log(HELP);
    process.exit(argv._.length === 0 && !argv.help ? 1 : 0);
  }

  const rules = csv(argv.rules);
  const keyword = csv(argv.keyword);
  const severity: SeverityMap = {};
  for (const id of csv(argv.warn) ?? []) severity[id] = 'warn';
  for (const id of csv(argv.off) ?? []) severity[id] = 'off';

  const reports = await lintFiles(argv._, { rules, keyword, severity });

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
