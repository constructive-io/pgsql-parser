/**
 * AST transform that applies an {@link ExtensionRouter}.
 *
 * Unlike the schema transform — which only rewrites string *fields* already
 * present on a node — moving an extension changes the **shape** of the AST:
 *
 * - `CREATE EXTENSION <e>` with no `SCHEMA` clause must gain one, which means
 *   constructing a new `DefElem` node and attaching it to a (possibly absent)
 *   `options` array; the reverse strips the `DefElem` (and empties `options`).
 * - a bare `crypt(...)` reference gains a schema qualifier (a `String` node is
 *   prepended to `funcname`), and the reverse removes it.
 *
 * All rewrites are AST-precise and driven by the router's version-aware symbol
 * inventory, so built-ins that merely share a name with an extension symbol
 * (and symbols that have graduated into core) are left untouched.
 */

import { walk, walkSqlAst } from '@pgsql/traverse';
import { Deparser, parseSql, transformSync } from 'plpgsql-parser';

import type { ExtensionRouteSpec, ExtensionRouterOptions, ExtensionSymbolNamespace } from './extension-router';
import { ExtensionRouter } from './extension-router';

/** What an extension transform changed. */
export interface ExtensionTransformResult {
  /** Extensions whose install schema was rewritten: extname -> target (null = unqualified). */
  installsMoved: Map<string, string | null>;
  /** Symbol references rewritten, counted by bare symbol name. */
  symbolsRewritten: Map<string, number>;
}

/** Create a fresh result tracker. */
export function createExtensionResult(): ExtensionTransformResult {
  return { installsMoved: new Map(), symbolsRewritten: new Map() };
}

function schemaStringNode(schema: string): any {
  return { String: { sval: schema } };
}

/**
 * Rewrite a (possibly schema-qualified) name list in place against the router.
 * `names` is the node's own array (`funcname`, `TypeName.names`, ...); it is
 * mutated in place so the enclosing node keeps referring to it.
 */
function rewriteNameList(
  names: any[] | undefined,
  router: ExtensionRouter,
  ns: ExtensionSymbolNamespace,
  result: ExtensionTransformResult
): void {
  if (!Array.isArray(names) || names.length === 0) return;
  const parts = names.map((n: any) => n?.String?.sval);
  if (parts.some(p => typeof p !== 'string')) return; // non-identifier element (e.g. %type)

  const name = parts[parts.length - 1];
  const schema = parts.length >= 2 ? parts[parts.length - 2] : null;
  const rewrite = router.resolveSymbol(schema, name, ns);
  if (!rewrite) return;

  if (rewrite.to === null) {
    // Strip qualification: keep only the bare name node.
    names.splice(0, names.length - 1);
  } else if (schema === null) {
    // Qualify a bare reference: prepend the target schema.
    names.unshift(schemaStringNode(rewrite.to));
  } else {
    // Requalify: rewrite the existing schema element.
    names[names.length - 2].String.sval = rewrite.to;
  }
  result.symbolsRewritten.set(name, (result.symbolsRewritten.get(name) ?? 0) + 1);
}

/** Read/replace the `schema` DefElem inside a `CreateExtensionStmt.options`. */
function setExtensionSchemaOption(node: any, target: string | null): boolean {
  const options: any[] = Array.isArray(node.options) ? node.options : [];
  const idx = options.findIndex((opt: any) => opt?.DefElem?.defname === 'schema');

  if (target === null) {
    // Install with no explicit SCHEMA clause: remove any existing option.
    if (idx === -1) return false;
    options.splice(idx, 1);
    if (options.length === 0) delete node.options;
    else node.options = options;
    return true;
  }

  const defElem = {
    DefElem: {
      defname: 'schema',
      arg: { String: { sval: target } },
      defaction: 'DEFELEM_UNSPEC'
    }
  };
  if (idx === -1) {
    options.push(defElem);
  } else {
    const existing = options[idx].DefElem;
    if (existing.arg?.String?.sval === target) return false;
    existing.arg = { String: { sval: target } };
  }
  node.options = options;
  return true;
}

/**
 * Create a SQL AST visitor that applies extension routing. Composable with the
 * walkers used by the core transform and by PL/pgSQL body traversal.
 */
export function createExtensionVisitor(
  router: ExtensionRouter,
  result: ExtensionTransformResult
) {
  const rewriteBody = router.hasSymbolRoutes();

  return {
    CreateExtensionStmt: (path: any) => {
      const node = path.node;
      const target = router.resolveInstall(node.extname);
      if (target === undefined) return;
      if (setExtensionSchemaOption(node, target)) {
        result.installsMoved.set(node.extname, target);
      }
    },

    // ALTER EXTENSION <e> SET SCHEMA <newschema>. The walker does not recurse
    // into AlterObjectSchemaStmt.object; a null target has no SET SCHEMA form
    // (a schema must be named), so it is left unchanged.
    AlterObjectSchemaStmt: (path: any) => {
      const node = path.node;
      if (node.objectType !== 'OBJECT_EXTENSION') return;
      const extname = node.object?.String?.sval;
      const target = router.resolveInstall(extname);
      if (typeof target !== 'string' || target === node.newschema) return;
      node.newschema = target;
      result.installsMoved.set(extname, target);
    },

    FuncCall: (path: any) => {
      rewriteNameList(path.node.funcname, router, 'function', result);
    },

    // The walker does not auto-recurse into CallStmt.funccall.
    CallStmt: (path: any) => {
      if (path.node.funccall) {
        rewriteNameList(path.node.funccall.funcname, router, 'function', result);
      }
    },

    TypeName: (path: any) => {
      rewriteNameList(path.node.names, router, 'type', result);
    },

    CreateFunctionStmt: (path: any) => {
      const node = path.node;
      if (!rewriteBody) return;
      // LANGUAGE sql bodies are opaque strings to the walker; parse and rewrite
      // them separately (PL/pgSQL bodies ride the hydrated walk in transformExtensions).
      const isPlpgsql = (node.options ?? []).some(
        (opt: any) =>
          opt?.DefElem?.defname === 'language' &&
          opt.DefElem.arg?.String?.sval === 'plpgsql'
      );
      if (isPlpgsql || !Array.isArray(node.options)) return;
      for (const opt of node.options) {
        if (opt?.DefElem?.defname === 'as' && opt.DefElem.arg?.List?.items) {
          for (const item of opt.DefElem.arg.List.items) {
            if (typeof item?.String?.sval === 'string') {
              try {
                item.String.sval = rewriteSqlBodyString(item.String.sval, router, result);
              } catch {
                // Not parseable standalone (e.g. C symbol names) — leave as-is.
              }
            }
          }
        }
      }
    }
  };
}

/** Rewrite extension references inside a `LANGUAGE sql` body string. */
function rewriteSqlBodyString(
  body: string,
  router: ExtensionRouter,
  result: ExtensionTransformResult
): string {
  const stmts: any[] = parseSql(body)?.stmts ?? [];
  if (stmts.length === 0) return body;
  const visitor = createExtensionVisitor(router, result);
  const pieces: string[] = [];
  for (const stmt of stmts) {
    if (!stmt?.stmt) continue;
    walkSqlAst(stmt.stmt, visitor);
    pieces.push(Deparser.deparse(stmt.stmt));
  }
  return pieces.join(';\n');
}

/**
 * Apply extension routing to a SQL string: parse -> walk -> deparse, including
 * PL/pgSQL and `LANGUAGE sql` bodies. Returns the rewritten SQL and a summary
 * of what changed.
 */
export function transformExtensions(
  sql: string,
  router: ExtensionRouter | ExtensionRouteSpec,
  options: ExtensionRouterOptions = {}
): { sql: string; result: ExtensionTransformResult } {
  const resolved = ExtensionRouter.from(router, options);
  const result = createExtensionResult();

  const out = transformSync(sql, (ctx: any) => {
    walk(ctx, createExtensionVisitor(resolved, result), {
      // Bodies only matter when a symbol (function/operator/type) is routed;
      // a bare extension rename never appears inside one.
      walkFunctionBodies: resolved.hasSymbolRoutes()
    });
  }, { hydrate: true, pretty: true });

  return { sql: out, result };
}
