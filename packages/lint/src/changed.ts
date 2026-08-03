/**
 * Changed-file detection for `--changed`, so a CI gate (or a human before a
 * commit) pays only for the SQL that a branch actually touched.
 *
 * Modelled on pgpm's bundle-drift check (`pgpm/core/src/packaging/check.ts` in
 * constructive): resolve a base ref (explicit → `origin/$GITHUB_BASE_REF` in a
 * PR → the repository's default branch), diff `HEAD` against the **merge base**
 * so unrelated commits on the base branch don't widen the set, and union that
 * with uncommitted/untracked working-tree changes. Deleted paths are dropped —
 * there is nothing left on disk to lint.
 */

import { execFileSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import * as path from 'path';

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024
  });
}

function tryGit(args: string[], cwd: string): string | null {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

/** The repository's default branch as a remote-tracking ref, when discoverable. */
function defaultBranch(cwd: string): string | undefined {
  const head = tryGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], cwd);
  if (head && head.trim()) return head.trim();
  for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
    if (tryGit(['rev-parse', '--verify', '--quiet', candidate], cwd)) return candidate;
  }
  return undefined;
}

/**
 * Resolve the ref to diff against. An explicit `base` wins; otherwise the PR
 * base branch (`origin/$GITHUB_BASE_REF`) when running in GitHub Actions;
 * otherwise the repository's default branch. `undefined` means "no base" and
 * the caller falls back to working-tree changes only.
 */
export function resolveChangedBase(base?: string, cwd: string = process.cwd()): string | undefined {
  if (base && base.trim()) return base.trim();
  const prBase = process.env.GITHUB_BASE_REF;
  if (prBase && prBase.trim()) {
    const ref = `origin/${prBase.trim()}`;
    if (tryGit(['rev-parse', '--verify', '--quiet', ref], cwd)) return ref;
    return prBase.trim();
  }
  return defaultBranch(cwd);
}

export interface ChangedFilesResult {
  /** Absolute paths of changed files that still exist on disk. */
  files: string[];
  /** The base ref used, if any. */
  base?: string;
  /** The merge base actually diffed against, if one was resolvable. */
  mergeBase?: string;
}

/** Parse `git status --porcelain` into paths (rename target wins). */
function workingTreePaths(cwd: string): string[] {
  const out: string[] = [];
  // `-uall` lists untracked *files*; the default collapses a new directory to
  // the directory name, which would hide every file a new module adds.
  const status = tryGit(['status', '--porcelain', '-uall'], cwd) ?? '';
  for (const rawLine of status.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    let p = line.slice(3);
    const arrow = p.indexOf(' -> ');
    if (arrow !== -1) p = p.slice(arrow + 4);
    p = p.replace(/^"|"$/g, '');
    if (p) out.push(p);
  }
  return out;
}

/**
 * Collect the files that differ from `base` (via `git merge-base`) plus any
 * uncommitted/untracked working-tree changes. Falls back to `git diff HEAD`
 * when no base is resolvable or no merge base exists — a shallow clone or a
 * detached CI checkout — rather than failing the run.
 */
export function changedFiles(options: { cwd?: string; base?: string } = {}): ChangedFilesResult {
  const cwd = options.cwd ?? process.cwd();
  if (!tryGit(['rev-parse', '--git-dir'], cwd)) {
    throw new Error(`--changed needs a git repository; ${cwd} is not inside one`);
  }

  const files = new Set<string>(workingTreePaths(cwd));
  const base = resolveChangedBase(options.base, cwd);
  let mergeBase: string | undefined;

  if (base) {
    const found = tryGit(['merge-base', 'HEAD', base], cwd);
    mergeBase = found?.trim() || undefined;
  }
  // No base, or no common ancestor (shallow clone / detached checkout): the
  // uncommitted diff against HEAD is all the history we can see.
  const diffArgs = mergeBase
    ? ['diff', '--name-only', '--diff-filter=ACMR', mergeBase, 'HEAD']
    : ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'];
  for (const rawLine of (tryGit(diffArgs, cwd) ?? '').split('\n')) {
    const p = rawLine.trim();
    if (p) files.add(p);
  }

  const abs: string[] = [];
  for (const rel of files) {
    const full = path.resolve(cwd, rel);
    // Deleted or renamed-away paths have nothing left to lint.
    if (existsSync(full) && statSync(full).isFile()) abs.push(full);
  }
  return { files: abs.sort(), base, mergeBase };
}

/** {@link changedFiles}, narrowed to `.sql`. */
export function changedSqlFiles(options: { cwd?: string; base?: string } = {}): ChangedFilesResult {
  const result = changedFiles(options);
  return { ...result, files: result.files.filter((f) => f.toLowerCase().endsWith('.sql')) };
}
