/**
 * Bundle transpile/apply drivers.
 *
 * Adapters that plug this package's AST transforms into the pgpm migration
 * bundle seams (`transpileBundle`'s `renameChange`/`transformScript` and
 * `applyBundle`'s `validateReferences`). The seams are structurally typed on
 * purpose — no dependency on `@pgpmjs/bundle`/`@pgpmjs/core` — so the driver
 * stays a pure function factory over `transformSql` and `classifyStatements`.
 */

import { classifyStatements } from './facts';
import { SchemaTransformResult, transformSql, TransformSqlOptions } from './transform';

/** Identity of the script being transformed/validated (matches the bundle seams). */
export interface BundleScriptContext {
  change: string;
  kind: 'deploy' | 'revert' | 'verify';
}

export interface SchemaTranspilerOptions {
  /** Old schema name → new schema name. Drives both dimensions. */
  schemaMap: Record<string, string>;
  /** Forwarded to {@link transformSql} (round-trip validation, extra passes). */
  transform?: TransformSqlOptions;
}

export interface SchemaTranspiler {
  /**
   * Change-name/path rewrite (the pgpm structural dimension): renames the
   * segment following any `schemas` path segment, e.g.
   * `schemas/auth/tables/users` → `schemas/tenant_auth/tables/users`.
   */
  renameChange: (name: string) => string;
  /**
   * SQL body rewrite (the AST dimension): full AST transform of every mapped
   * schema reference via {@link transformSql}, including PL/pgSQL bodies.
   * Throws if a mapped schema survives untransformed.
   */
  transformScript: (sql: string, ctx: BundleScriptContext) => string;
  /**
   * Accumulated report across every script this transpiler has transformed:
   * schemas found/transformed and any per-script errors.
   */
  result: SchemaTransformResult;
}

/**
 * Build the caller-supplied callbacks for `transpileBundle` from a single
 * schema map, so the folder/plan rename and the in-SQL rewrite stay in
 * lockstep.
 */
export function makeSchemaTranspiler(options: SchemaTranspilerOptions): SchemaTranspiler {
  const mapping = new Map(Object.entries(options.schemaMap));
  const result: SchemaTransformResult = {
    schemasFound: new Set(),
    schemasTransformed: new Map(),
    errors: []
  };

  const renameChange = (name: string): string => {
    const parts = name.split('/');
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === 'schemas' && mapping.has(parts[i + 1])) {
        parts[i + 1] = mapping.get(parts[i + 1])!;
      }
    }
    return parts.join('/');
  };

  const transformScript = (sql: string, _ctx: BundleScriptContext): string => {
    return transformSql(sql, mapping, options.transform, result).content;
  };

  return { renameChange, transformScript, result };
}

export interface NamespaceValidatorOptions {
  /** Schemas the bundle is allowed to create objects in or reference. */
  allowedSchemas: string[];
  /**
   * Also flag statements whose PL/pgSQL bodies execute dynamic SQL — their
   * references are invisible to the AST, so containment cannot be proven.
   * Off by default (dynamic SQL is common in legitimate functions).
   */
  flagDynamicSql?: boolean;
}

/**
 * Build an `applyBundle`-compatible `validateReferences` callback: returns a
 * description of every schema-qualified object a script creates or references
 * outside the allowed namespace. Unqualified references resolve via
 * search_path and are not reported.
 */
export function makeNamespaceValidator(
  options: NamespaceValidatorOptions
): (sql: string, ctx: BundleScriptContext) => string[] {
  const allowed = new Set(options.allowedSchemas);

  return (sql: string, _ctx: BundleScriptContext): string[] => {
    const violations = new Set<string>();
    for (const facts of classifyStatements(sql)) {
      for (const ref of [...facts.creates, ...facts.references, ...facts.fkTargets]) {
        if (ref.schema && !allowed.has(ref.schema)) {
          violations.add(`${facts.nodeTag}: ${ref.schema}.${ref.name}`);
        }
      }
      if (options.flagDynamicSql && facts.dynamicSql) {
        violations.add(`${facts.nodeTag}: dynamic SQL — references not statically verifiable`);
      }
    }
    return [...violations];
  };
}
