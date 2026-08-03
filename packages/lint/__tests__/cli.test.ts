import { execFile, execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const CLI = path.join(__dirname, '..', 'dist', 'cli.js');
const FIXTURES = path.join(__dirname, '__fixtures__');
const DIRTY = fs.existsSync(path.join(FIXTURES, 'migration.sql'))
  ? fs.readFileSync(path.join(FIXTURES, 'migration.sql'), 'utf8')
  : '';

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runCli(args: string[], cwd?: string): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI, ...args], { cwd });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

/** The files a JSON run reported findings for. */
function withFindings(stdout: string): string[] {
  const reports = JSON.parse(stdout) as Array<{ file: string; findings: unknown[] }>;
  return reports.filter((r) => r.findings.length > 0).map((r) => r.file);
}

/** A throwaway repo with one clean commit on `main`. */
function repo(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pgsql-lint-cli-')));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'test');
  fs.writeFileSync(path.join(dir, 'base.sql'), '-- nothing to lint\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'base');
  return dir;
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

describeIfBuilt('pgsql-lint CLI --ignore', () => {
  it('excludes an ignored directory', async () => {
    const dir = repo();
    fs.mkdirSync(path.join(dir, 'sql'));
    fs.writeFileSync(path.join(dir, 'sql', 'generated.sql'), DIRTY);

    expect((await runCli(['.', '--quiet'], dir)).code).toBe(1);
    const { code, stdout } = await runCli(['.', '--ignore', 'sql/'], dir);
    expect(code).toBe(0);
    expect(stdout).toContain('0 errors');
  });

  it('accepts a comma-separated list and a repeated flag', async () => {
    const dir = repo();
    fs.mkdirSync(path.join(dir, 'sql'));
    fs.mkdirSync(path.join(dir, 'gen'));
    fs.writeFileSync(path.join(dir, 'sql', 'a.sql'), DIRTY);
    fs.writeFileSync(path.join(dir, 'gen', 'b.sql'), DIRTY);

    expect((await runCli(['.', '--ignore', 'sql/,gen/'], dir)).code).toBe(0);
    expect((await runCli(['.', '--ignore', 'sql/', '--ignore', 'gen/'], dir)).code).toBe(0);
    expect((await runCli(['.', '--ignore', 'sql/'], dir)).code).toBe(1);
  });
});

describeIfBuilt('pgsql-lint CLI --changed', () => {
  it('exits 0 with no findings when nothing changed', async () => {
    const dir = repo();
    const { code, stdout } = await runCli(['--changed', 'main'], dir);
    expect(code).toBe(0);
    expect(stdout).toContain('no changed .sql files');
  });

  it('lints only the changed file', async () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'new.sql'), DIRTY);
    const { code, stdout } = await runCli(['--changed', 'main', '--json'], dir);
    expect(code).toBe(1);
    const reports = JSON.parse(stdout);
    expect(reports).toHaveLength(1);
    expect(reports[0].file).toBe(path.join(dir, 'new.sql'));
  });

  it('auto-detects the base with no argument', async () => {
    const dir = repo();
    git(dir, 'checkout', '-q', '-b', 'feature');
    fs.writeFileSync(path.join(dir, 'new.sql'), DIRTY);
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'add');

    const { code, stdout } = await runCli(['--changed', '--json'], dir);
    expect(code).toBe(1);
    expect(JSON.parse(stdout)).toHaveLength(1);
  });

  it('does not swallow a following path argument', async () => {
    const dir = repo();
    fs.mkdirSync(path.join(dir, 'pkg'));
    fs.writeFileSync(path.join(dir, 'pkg', 'a.sql'), DIRTY);
    fs.writeFileSync(path.join(dir, 'other.sql'), DIRTY);

    // `--changed pkg` — `pkg` is a path, so it scopes the changed set.
    const { code, stdout } = await runCli(['--changed', 'pkg', '--json'], dir);
    expect(code).toBe(1);
    const reports = JSON.parse(stdout);
    expect(reports).toHaveLength(1);
    expect(reports[0].file).toBe(path.join(dir, 'pkg', 'a.sql'));
  });

  it('honours --ignore over the changed set', async () => {
    const dir = repo();
    fs.mkdirSync(path.join(dir, 'sql'));
    fs.writeFileSync(path.join(dir, 'sql', 'generated.sql'), DIRTY);
    expect((await runCli(['--changed', 'main'], dir)).code).toBe(1);
    expect((await runCli(['--changed', 'main', '--ignore', 'sql/'], dir)).code).toBe(0);
  });
});

describeIfBuilt('pgsql-lint CLI config file', () => {
  it('applies ignore, paths, and warn from .pgsqllintrc.json', async () => {
    const dir = repo();
    fs.mkdirSync(path.join(dir, 'sql'));
    fs.mkdirSync(path.join(dir, 'pkg'));
    fs.writeFileSync(path.join(dir, 'sql', 'generated.sql'), DIRTY);
    fs.writeFileSync(path.join(dir, 'pkg', 'hand-written.sql'), DIRTY);
    fs.writeFileSync(
      path.join(dir, '.pgsqllintrc.json'),
      JSON.stringify({ ignore: ['sql/'], paths: ['.'] })
    );

    const withConfig = await runCli(['--json'], dir);
    expect(withConfig.code).toBe(1);
    expect(withFindings(withConfig.stdout)).toEqual([path.join(dir, 'pkg', 'hand-written.sql')]);

    // Same tree, config ignored: the generated file is linted too.
    const ignored = await runCli(['.', '--no-config', '--json'], dir);
    // Paths are reported as given, so a positional `.` yields relative paths.
    expect(withFindings(ignored.stdout)).toEqual([
      path.join('pkg', 'hand-written.sql'),
      path.join('sql', 'generated.sql')
    ]);
  });

  it('downgrades to a warning from the config file, and a flag overrides it', async () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'a.sql'), DIRTY);
    fs.writeFileSync(
      path.join(dir, '.pgsqllintrc.json'),
      JSON.stringify({ warn: ['require-qualified-refs'], paths: ['.'] })
    );
    expect((await runCli([], dir)).code).toBe(0);
    // An explicit --warn replaces the config's list, so C3 fails again.
    expect((await runCli(['--warn', 'C4'], dir)).code).toBe(1);
  });

  it('exits 2 with a readable error on a bad config file', async () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, '.pgsqllintrc.json'), '{ "nope": true }');
    const { code, stderr } = await runCli(['.'], dir);
    expect(code).toBe(2);
    expect(stderr).toContain('unknown key');
  });
});
