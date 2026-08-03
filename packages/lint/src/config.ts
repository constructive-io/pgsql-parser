/**
 * Config-file support — so a repository states its lint policy once, in a file,
 * instead of repeating flags in every workflow step and every shell history.
 *
 * The keys mirror the CLI flags exactly (`rules`, `warn`, `off`, `ignore`,
 * `keyword`, `paths`), and a flag always overrides the file. Discovery walks up
 * from `cwd` looking for `.pgsqllintrc.json` / `.pgsqllintrc`.
 *
 * `extends` names another config *file* (a relative path resolved against the
 * file that declared it, or a resolvable npm module). This package has no
 * built-in presets — its rule set is injected as values, not discovered by name
 * — so unlike safegres's `extends: "safegres:constructive"` there is nothing to
 * name but a file.
 */

import { existsSync, readFileSync } from 'fs';
import * as path from 'path';

/** The shape of `.pgsqllintrc.json`. Every key mirrors a CLI flag. */
export interface LintConfigFile {
  /** Another config file to inherit from (path, or npm module). */
  extends?: string | string[];
  /** Rule ids/codes to run (default: all). */
  rules?: string[];
  /** Rules reported as warnings. */
  warn?: string[];
  /** Rules disabled entirely. */
  off?: string[];
  /** Glob patterns to exclude. */
  ignore?: string[];
  /** Suppression directive keyword(s). */
  keyword?: string | string[];
  /** Default paths to lint when none are given on the command line. */
  paths?: string[];
}

export const CONFIG_FILENAMES = ['.pgsqllintrc.json', '.pgsqllintrc'] as const;

const KNOWN_KEYS = new Set([
  '$schema',
  'extends',
  'rules',
  'warn',
  'off',
  'ignore',
  'keyword',
  'paths'
]);

/** Walk up from `cwd` for the first config file. */
export function findConfigFile(cwd: string = process.cwd()): string | undefined {
  let dir = path.resolve(cwd);
  for (;;) {
    for (const name of CONFIG_FILENAMES) {
      const candidate = path.join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function readConfigFile(file: string): LintConfigFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`could not parse ${file}: ${(err as Error).message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${file}: expected a JSON object`);
  }
  const config = parsed as Record<string, unknown>;
  const unknown = Object.keys(config).filter((k) => !KNOWN_KEYS.has(k));
  if (unknown.length > 0) {
    throw new Error(
      `${file}: unknown key(s) ${unknown.join(', ')} — expected any of ` +
        `${[...KNOWN_KEYS].filter((k) => k !== '$schema').join(', ')}`
    );
  }
  return config as LintConfigFile;
}

/** Resolve an `extends` target: a path relative to `from`, or an npm module. */
function resolveExtends(target: string, from: string): string {
  const asPath = path.resolve(path.dirname(from), target);
  for (const candidate of [asPath, `${asPath}.json`]) {
    if (existsSync(candidate)) return candidate;
  }
  try {
    return require.resolve(target, { paths: [path.dirname(from)] });
  } catch {
    throw new Error(
      `${from}: could not resolve "extends": ${target} — it is read as a path ` +
        'relative to the file that declared it, or as an npm module'
    );
  }
}

/** Later layers win; array keys replace rather than merge. */
function merge(base: LintConfigFile, over: LintConfigFile): LintConfigFile {
  const out: LintConfigFile = { ...base, ...over };
  delete out.extends;
  return out;
}

function expand(file: string, seen: Set<string>): LintConfigFile {
  if (seen.has(file)) throw new Error(`circular "extends" chain at ${file}`);
  seen.add(file);
  const config = readConfigFile(file);
  const parents = config.extends
    ? Array.isArray(config.extends)
      ? config.extends
      : [config.extends]
    : [];
  let acc: LintConfigFile = {};
  for (const parent of parents) {
    acc = merge(acc, expand(resolveExtends(parent, file), seen));
  }
  return merge(acc, config);
}

export interface LoadedLintConfig {
  config: LintConfigFile;
  /** The file the config was read from, when one was found. */
  filepath?: string;
}

/**
 * Load the effective config: an explicit `configFile`, else the nearest
 * discovered one, else empty. Paths in `ignore`/`paths` stay as written — the
 * caller resolves them against the config file's directory (see `configDir`).
 */
export function loadLintConfig(
  params: { cwd?: string; configFile?: string } = {}
): LoadedLintConfig {
  const cwd = params.cwd ?? process.cwd();
  const filepath = params.configFile
    ? path.resolve(cwd, params.configFile)
    : findConfigFile(cwd);
  if (!filepath) return { config: {} };
  if (!existsSync(filepath)) throw new Error(`config file not found: ${filepath}`);
  return { config: expand(filepath, new Set()), filepath };
}

/** The directory a discovered config's relative paths resolve against. */
export function configDir(loaded: LoadedLintConfig, cwd: string = process.cwd()): string {
  return loaded.filepath ? path.dirname(loaded.filepath) : cwd;
}
