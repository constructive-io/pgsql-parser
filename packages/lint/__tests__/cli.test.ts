import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const CLI = path.join(__dirname, '..', 'dist', 'cli.js');
const FIXTURES = path.join(__dirname, '__fixtures__');

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runCli(args: string[]): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI, ...args]);
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

// The CLI is exercised against the built dist/ (CI runs `pnpm build` first).
const built = fs.existsSync(CLI);
const describeIfBuilt = built ? describe : describe.skip;

describeIfBuilt('pgsql-lint CLI', () => {
  it('exits 1 and reports the C3 finding as JSON', async () => {
    const { code, stdout } = await runCli([path.join(FIXTURES, 'migration.sql'), '--json']);
    expect(code).toBe(1);
    const reports = JSON.parse(stdout);
    const findings = reports.flatMap((r: { findings: unknown[] }) => r.findings);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('C3');
  });

  it('exits 0 when only some rules are selected and none match', async () => {
    const { code } = await runCli([path.join(FIXTURES, 'migration.sql'), '--rules', 'no-dynamic-sql']);
    expect(code).toBe(0);
  });

  it('exits 0 when the only finding is downgraded to a warning', async () => {
    const { code } = await runCli([
      path.join(FIXTURES, 'migration.sql'),
      '--warn',
      'require-qualified-refs'
    ]);
    expect(code).toBe(0);
  });

  it('reports the finding as a warning in JSON when downgraded', async () => {
    const { stdout } = await runCli([
      path.join(FIXTURES, 'migration.sql'),
      '--warn',
      'C3',
      '--json'
    ]);
    const reports = JSON.parse(stdout);
    const findings = reports.flatMap((r: { findings: { severity: string }[] }) => r.findings);
    expect(findings[0].severity).toBe('warn');
  });

  it('exits 0 when the rule is turned off', async () => {
    const { code } = await runCli([
      path.join(FIXTURES, 'migration.sql'),
      '--off',
      'require-qualified-refs'
    ]);
    expect(code).toBe(0);
  });

  it('prints help and exits 0 with --help', async () => {
    const { code, stdout } = await runCli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('pgsql-lint');
    expect(stdout).toContain('no-dynamic-sql');
  });
});
