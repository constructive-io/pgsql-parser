/**
 * Path exclusion for the file runner — `--ignore` / `ignore` in a config file.
 *
 * Most repositories that lint SQL on disk also *generate* SQL on disk
 * (packaged modules, introspected schemas, codegen output), and linting
 * generated output is noise. Patterns are gitignore-flavoured globs matched
 * against the path relative to `cwd`:
 *
 *   - `*` matches within a segment, `**` across segments, `?` one character.
 *   - A pattern with no glob character matches that path *and everything under
 *     it*, so `sql/` and `sql` both exclude `sql/app--1.0.0.sql`.
 *   - An unanchored pattern (no leading `/`) also matches at any segment
 *     boundary, so `generated/`, `**` patterns, and `*.gen.sql` all work.
 *   - A leading `/` anchors the pattern to `cwd`.
 */

import * as path from 'path';

/** Turn a glob into a `RegExp` source anchored at both ends. */
function globToRegExpSource(glob: string): string {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        // `**/` may match zero segments, so `**/gen/**` also matches `gen/x`.
        if (glob[i + 2] === '/') {
          out += '(?:.*/)?';
          i += 2;
        } else {
          out += '.*';
          i += 1;
        }
      } else {
        out += '[^/]*';
      }
      continue;
    }
    if (ch === '?') {
      out += '[^/]';
      continue;
    }
    out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return out;
}

interface CompiledPattern {
  re: RegExp;
  /** Anchored patterns only match from the root of the relative path. */
  anchored: boolean;
}

function compile(pattern: string): CompiledPattern | null {
  let p = pattern.trim().replace(/\\/g, '/');
  if (!p || p.startsWith('#')) return null;
  const anchored = p.startsWith('/');
  if (anchored) p = p.slice(1);
  p = p.replace(/^\.\//, '');
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.replace(/\/+$/, '');
  if (!p) return null;
  // A plain path (or an explicit directory) excludes the subtree under it.
  const source = /[*?]/.test(p) && !dirOnly
    ? globToRegExpSource(p)
    : `${globToRegExpSource(p)}(?:/.*)?`;
  return { re: new RegExp(`^${source}$`), anchored };
}

/**
 * Build a predicate that answers "is this file ignored?". Paths may be
 * absolute or relative; both are compared as `cwd`-relative POSIX paths.
 */
export function makeIgnoreFilter(
  patterns: string[] = [],
  cwd: string = process.cwd()
): (file: string) => boolean {
  const compiled = patterns.map(compile).filter((c): c is CompiledPattern => c !== null);
  if (compiled.length === 0) return () => false;
  return (file: string): boolean => {
    const rel = path.relative(cwd, path.resolve(cwd, file)).replace(/\\/g, '/');
    // Outside cwd entirely — no relative pattern can meaningfully describe it.
    if (rel.startsWith('../')) return false;
    const segments = rel.split('/');
    for (const { re, anchored } of compiled) {
      if (re.test(rel)) return true;
      if (anchored) continue;
      // Unanchored: also try every suffix that starts at a segment boundary,
      // so `generated/` matches `packages/x/generated/y.sql`.
      for (let i = 1; i < segments.length; i++) {
        if (re.test(segments.slice(i).join('/'))) return true;
      }
    }
    return false;
  };
}

/** Filter a list of files through {@link makeIgnoreFilter}. */
export function applyIgnore(files: string[], patterns?: string[], cwd?: string): string[] {
  if (!patterns || patterns.length === 0) return files;
  const ignored = makeIgnoreFilter(patterns, cwd);
  return files.filter((f) => !ignored(f));
}
