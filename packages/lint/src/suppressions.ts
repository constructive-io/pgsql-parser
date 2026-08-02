/**
 * ESLint / Prettier-style suppression comments, embedded in the SQL body as
 * `--` line comments. Because they live in the function source, a waiver
 * authored in a migration survives `pg_get_functiondef` and is visible to any
 * downstream consumer (a live-database audit, a pre-commit hook) — the comment
 * is the single source of truth.
 *
 * Grammar (a `--` comment containing), with `<kw>` the directive keyword
 * (`pgsql-lint` by default; `safegres` is also accepted):
 *
 *   <kw>-disable-next-line [<rule>…] [-- <reason>]   next physical line
 *   <kw>-disable-line      [<rule>…] [-- <reason>]   this physical line
 *   <kw>-disable           [<rule>…] [-- <reason>]   until a matching enable
 *   <kw>-enable            [<rule>…]                 closes a disable range
 *   <kw>-disable-file      [<rule>…] [-- <reason>]   the whole definition
 *
 * With no rule listed a directive applies to every rule. A reason follows a
 * second `--` (ESLint style) or a `:`. Rules whose metadata requires a reason
 * are *not* silenced by a reasonless directive — the finding stands, so a
 * waiver is never silent.
 */

import type { SuppressionScope } from './types';

/** The directive keyword(s) recognised when none is configured explicitly. */
export const DEFAULT_KEYWORDS = ['pgsql-lint', 'safegres'];

interface LineDirective {
  scope: 'next-line' | 'line';
  targetLine: number;
  rules: Set<string> | null;
  reason: string | null;
}

interface Interval {
  rule: string | null;
  start: number;
  end: number;
  reason: string | null;
}

interface FileDirective {
  rules: Set<string> | null;
  reason: string | null;
}

export interface SuppressionMatch {
  scope: SuppressionScope;
  reason: string | null;
}

export interface SuppressionResolution {
  /** The directive silences the finding. */
  suppressed: boolean;
  scope?: SuppressionScope;
  reason?: string | null;
  /** A directive matched but lacked a required reason, so it does not apply. */
  invalidMissingReason?: boolean;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function directiveRe(keywords: string[]): RegExp {
  const kw = keywords.map(escapeRegExp).join('|');
  return new RegExp(
    `(?:${kw})-(disable-next-line|disable-line|disable-file|disable|enable)\\b[ \\t]*([^\\r\\n]*)`,
    'i'
  );
}

function splitReason(rest: string): { ruleSpec: string; reason: string | null } {
  const dashIdx = rest.indexOf('--');
  if (dashIdx >= 0) {
    return { ruleSpec: rest.slice(0, dashIdx), reason: normalizeReason(rest.slice(dashIdx + 2)) };
  }
  const colonIdx = rest.indexOf(':');
  if (colonIdx >= 0) {
    return { ruleSpec: rest.slice(0, colonIdx), reason: normalizeReason(rest.slice(colonIdx + 1)) };
  }
  return { ruleSpec: rest, reason: null };
}

function normalizeReason(s: string): string | null {
  const t = s.trim().replace(/\*\/\s*$/, '').trim();
  return t.length > 0 ? t : null;
}

function parseRules(ruleSpec: string): Set<string> | null {
  const parts = ruleSpec.split(/[\s,]+/).map((p) => p.trim()).filter((p) => p.length > 0);
  return parts.length > 0 ? new Set(parts) : null;
}

/** Parsed suppression state for one definition, queryable by (rule, line). */
export class Suppressions {
  private readonly lineDirectives: LineDirective[] = [];
  private readonly intervals: Interval[] = [];
  private readonly fileDirectives: FileDirective[] = [];

  constructor(lines: string[], keywords: string[] = DEFAULT_KEYWORDS) {
    const re = directiveRe(keywords);
    // Range bookkeeping: an open disable per rule (and one for "all").
    const open = new Map<string | null, { start: number; reason: string | null }>();

    lines.forEach((text, i) => {
      const line = i + 1;
      const m = re.exec(text);
      if (!m) return;
      const kind = m[1].toLowerCase();
      const { ruleSpec, reason } = splitReason(m[2] ?? '');
      const rules = parseRules(ruleSpec);

      switch (kind) {
      case 'disable-next-line':
        this.lineDirectives.push({ scope: 'next-line', targetLine: line + 1, rules, reason });
        break;
      case 'disable-line':
        this.lineDirectives.push({ scope: 'line', targetLine: line, rules, reason });
        break;
      case 'disable-file':
        this.fileDirectives.push({ rules, reason });
        break;
      case 'disable': {
        const keys: Array<string | null> = rules ? [...rules] : [null];
        for (const k of keys) if (!open.has(k)) open.set(k, { start: line, reason });
        break;
      }
      case 'enable': {
        const keys: Array<string | null> = rules ? [...rules] : [...open.keys()];
        for (const k of keys) {
          const o = open.get(k);
          if (o) {
            this.intervals.push({ rule: k, start: o.start, end: line, reason: o.reason });
            open.delete(k);
          }
        }
        break;
      }
      }
    });

    for (const [rule, o] of open) {
      this.intervals.push({ rule, start: o.start, end: Number.POSITIVE_INFINITY, reason: o.reason });
    }
  }

  private match(ruleId: string, line: number): SuppressionMatch | null {
    for (const f of this.fileDirectives) {
      if (f.rules === null || f.rules.has(ruleId)) return { scope: 'file', reason: f.reason };
    }
    for (const d of this.lineDirectives) {
      if (d.targetLine === line && (d.rules === null || d.rules.has(ruleId))) {
        return { scope: d.scope, reason: d.reason };
      }
    }
    for (const iv of this.intervals) {
      if ((iv.rule === null || iv.rule === ruleId) && line >= iv.start && line < iv.end) {
        return { scope: 'range', reason: iv.reason };
      }
    }
    return null;
  }

  /**
   * Resolve whether a finding is suppressed. `reasonRequired` rules are only
   * silenced by a directive that carries a reason.
   */
  resolve(ruleId: string, line: number, reasonRequired: boolean): SuppressionResolution {
    const m = this.match(ruleId, line);
    if (!m) return { suppressed: false };
    if (reasonRequired && (m.reason === null || m.reason.length === 0)) {
      return { suppressed: false, invalidMissingReason: true, scope: m.scope };
    }
    return { suppressed: true, scope: m.scope, reason: m.reason };
  }
}
