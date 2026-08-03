import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { changedSqlFiles, resolveChangedBase } from '../src';

const CLEAN = `CREATE SCHEMA app_public;
CREATE FUNCTION app_public.clean() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;
`;

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

/** A throwaway repo with one commit on `main`. */
function repo(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pgsql-lint-git-')));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'test');
  fs.writeFileSync(path.join(dir, 'base.sql'), CLEAN);
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'base');
  return dir;
}

describe('changedSqlFiles', () => {
  const saved = process.env.GITHUB_BASE_REF;
  beforeEach(() => {
    delete process.env.GITHUB_BASE_REF;
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.GITHUB_BASE_REF;
    else process.env.GITHUB_BASE_REF = saved;
  });

  it('returns nothing when the branch changed no SQL', () => {
    const dir = repo();
    expect(changedSqlFiles({ cwd: dir, base: 'main' }).files).toEqual([]);
  });

  it('finds committed .sql changes against the merge base', () => {
    const dir = repo();
    git(dir, 'checkout', '-q', '-b', 'feature');
    fs.writeFileSync(path.join(dir, 'added.sql'), CLEAN);
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'add sql');

    const result = changedSqlFiles({ cwd: dir, base: 'main' });
    expect(result.files).toEqual([path.join(dir, 'added.sql')]);
    expect(result.base).toBe('main');
    expect(result.mergeBase).toMatch(/^[0-9a-f]{40}$/);
  });

  it('ignores commits made on the base branch after the merge base', () => {
    const dir = repo();
    git(dir, 'checkout', '-q', '-b', 'feature');
    fs.writeFileSync(path.join(dir, 'added.sql'), CLEAN);
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'add sql');

    git(dir, 'checkout', '-q', 'main');
    fs.writeFileSync(path.join(dir, 'unrelated.sql'), CLEAN);
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'other work on main');
    git(dir, 'checkout', '-q', 'feature');

    expect(changedSqlFiles({ cwd: dir, base: 'main' }).files).toEqual([
      path.join(dir, 'added.sql')
    ]);
  });

  it('includes uncommitted and untracked files', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'untracked.sql'), CLEAN);
    fs.appendFileSync(path.join(dir, 'base.sql'), '\n-- edited\n');

    expect(changedSqlFiles({ cwd: dir, base: 'main' }).files).toEqual([
      path.join(dir, 'base.sql'),
      path.join(dir, 'untracked.sql')
    ]);
  });

  it('drops deleted and renamed-away paths', () => {
    const dir = repo();
    git(dir, 'checkout', '-q', '-b', 'feature');
    git(dir, 'mv', 'base.sql', 'moved.sql');
    git(dir, 'commit', '-qm', 'move');

    const files = changedSqlFiles({ cwd: dir, base: 'main' }).files;
    expect(files).toEqual([path.join(dir, 'moved.sql')]);
  });

  it('filters out non-SQL changes', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'notes.md'), '# hi\n');
    expect(changedSqlFiles({ cwd: dir, base: 'main' }).files).toEqual([]);
  });

  it('falls back to the working-tree diff when the base does not exist', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'untracked.sql'), CLEAN);
    const result = changedSqlFiles({ cwd: dir, base: 'origin/does-not-exist' });
    expect(result.mergeBase).toBeUndefined();
    expect(result.files).toEqual([path.join(dir, 'untracked.sql')]);
  });

  it('throws outside a git repository', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgsql-lint-nogit-'));
    expect(() => changedSqlFiles({ cwd: dir })).toThrow(/needs a git repository/);
  });
});

describe('resolveChangedBase', () => {
  const saved = process.env.GITHUB_BASE_REF;
  afterEach(() => {
    if (saved === undefined) delete process.env.GITHUB_BASE_REF;
    else process.env.GITHUB_BASE_REF = saved;
  });

  it('prefers an explicit base', () => {
    process.env.GITHUB_BASE_REF = 'develop';
    expect(resolveChangedBase('release/1.0', repo())).toBe('release/1.0');
  });

  it('uses the PR base branch in CI, unprefixed when no remote has it', () => {
    process.env.GITHUB_BASE_REF = 'develop';
    expect(resolveChangedBase(undefined, repo())).toBe('develop');
  });

  it('falls back to the repository default branch', () => {
    delete process.env.GITHUB_BASE_REF;
    expect(resolveChangedBase(undefined, repo())).toBe('main');
  });
});
