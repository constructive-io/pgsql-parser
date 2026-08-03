/**
 * Changed-file detection for `--changed`, so a CI gate (or a human before a
 * commit) pays only for the SQL that a branch actually touched.
 *
 * The git plumbing — base resolution, merge-base diff, working-tree union,
 * rename targets, dropping paths that no longer exist — lives in `git-changed`,
 * which is shared with pgpm's bundle-drift check. This module is the `.sql`
 * filter over it, and the place where "no base" stays non-fatal: a lint gate
 * that refuses to run on a shallow clone lints nothing, which is worse than
 * linting the working tree.
 */

import { changedFiles as gitChangedFiles, isRepo, resolveBase } from 'git-changed';

/**
 * Resolve the ref to diff against. An explicit `base` wins; otherwise the PR
 * base branch (`origin/$GITHUB_BASE_REF`) when running in GitHub Actions;
 * otherwise the repository's default branch. `undefined` means "no base" and
 * the caller falls back to working-tree changes only.
 */
export function resolveChangedBase(base?: string, cwd: string = process.cwd()): string | undefined {
  return resolveBase(base, cwd);
}

export interface ChangedFilesResult {
  /** Absolute paths of changed files that still exist on disk. */
  files: string[];
  /** The base ref used, if any. */
  base?: string;
  /** The merge base actually diffed against, if one was resolvable. */
  mergeBase?: string;
}

function collect(cwd: string, base: string | undefined, ext?: string): ChangedFilesResult {
  if (!isRepo(cwd)) {
    throw new Error(`--changed needs a git repository; ${cwd} is not inside one`);
  }
  const result = gitChangedFiles({ cwd, base, ext });
  return { files: result.paths, base: result.base, mergeBase: result.mergeBase };
}

/**
 * Collect the files that differ from `base` (via `git merge-base`) plus any
 * uncommitted/untracked working-tree changes.
 */
export function changedFiles(options: { cwd?: string; base?: string } = {}): ChangedFilesResult {
  return collect(options.cwd ?? process.cwd(), options.base);
}

/** {@link changedFiles}, narrowed to `.sql`. */
export function changedSqlFiles(options: { cwd?: string; base?: string } = {}): ChangedFilesResult {
  return collect(options.cwd ?? process.cwd(), options.base, '.sql');
}
