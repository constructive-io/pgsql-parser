/**
 * AST transform that applies a {@link RoleRouter}.
 *
 * Role identifiers surface in many statement forms. Most flow through a single
 * `RoleSpec` node (grantees, ownership `... OWNER TO`, `CREATE POLICY ... TO`,
 * `ALTER DEFAULT PRIVILEGES [FOR ROLE ...] ... TO`, `ALTER ROLE`, `DROP ROLE`,
 * role-membership grantees, `GRANTED BY`, `REASSIGN OWNED BY`), which the
 * traversal reaches automatically. Four positions carry a role name outside a
 * `RoleSpec` and are handled explicitly:
 *
 * - `CREATE ROLE <name>` — a bare string on `CreateRoleStmt.role`.
 * - `GRANT <role> TO ...` — the *granted* roles are `AccessPriv.priv_name`
 *   strings on `GrantRoleStmt.granted_roles` (not `RoleSpec`s).
 * - `SET ROLE` / `SET SESSION AUTHORIZATION` — the role is a string constant
 *   in `VariableSetStmt.args`.
 * - `ALTER ROLE <old> RENAME TO <new>` — `RenameStmt` with string
 *   `subname`/`newname`.
 *
 * Reserved role specifications (`PUBLIC`, `CURRENT_USER`, `SESSION_USER`, ...)
 * carry no `rolename` and a non-`CSTRING` `roletype`, so they are never
 * rewritten.
 */

import { walk as walkSql } from '@pgsql/traverse';
import { transformSync } from 'plpgsql-parser';

import type { RoleRouteSpec } from './role-router';
import { RoleRouter } from './role-router';

/** What a role transform changed: role name -> number of positions rewritten. */
export interface RoleTransformResult {
  rolesRenamed: Map<string, number>;
}

export function createRoleResult(): RoleTransformResult {
  return { rolesRenamed: new Map() };
}

const ROLE_SET_PARAMS = new Set(['role', 'session_authorization']);

/**
 * Create a SQL AST visitor that renames role identifiers against a router.
 * Composable with the walkers used by the core transform.
 */
export function createRoleVisitor(router: RoleRouter, result: RoleTransformResult) {
  const record = (name: string): void => {
    result.rolesRenamed.set(name, (result.rolesRenamed.get(name) ?? 0) + 1);
  };

  return {
    RoleSpec: (path: any) => {
      const node = path.node;
      // Only named roles (ROLESPEC_CSTRING) carry a rolename; PUBLIC /
      // CURRENT_USER / SESSION_USER are encoded by roletype and left alone.
      if (node.roletype !== 'ROLESPEC_CSTRING') return;
      const target = router.resolve(node.rolename);
      if (target === undefined) return;
      node.rolename = target;
      record(node.rolename);
    },

    CreateRoleStmt: (path: any) => {
      const node = path.node;
      const target = router.resolve(node.role);
      if (target === undefined) return;
      node.role = target;
      record(target);
    },

    GrantRoleStmt: (path: any) => {
      // granted_roles are role names carried as AccessPriv.priv_name (the
      // grantee_roles RoleSpecs are handled by the RoleSpec visitor).
      const granted = path.node.granted_roles;
      if (!Array.isArray(granted)) return;
      for (const g of granted) {
        const priv = g?.AccessPriv;
        if (!priv || typeof priv.priv_name !== 'string') continue;
        const target = router.resolve(priv.priv_name);
        if (target === undefined) continue;
        priv.priv_name = target;
        record(target);
      }
    },

    VariableSetStmt: (path: any) => {
      const node = path.node;
      if (!ROLE_SET_PARAMS.has(node.name) || !Array.isArray(node.args)) return;
      for (const arg of node.args) {
        const sval = arg?.A_Const?.sval?.sval ?? arg?.String?.sval;
        if (typeof sval !== 'string') continue;
        const target = router.resolve(sval);
        if (target === undefined) continue;
        if (arg.A_Const?.sval) arg.A_Const.sval.sval = target;
        else if (arg.String) arg.String.sval = target;
        record(target);
      }
    },

    RenameStmt: (path: any) => {
      const node = path.node;
      if (node.renameType !== 'OBJECT_ROLE') return;
      const subTarget = router.resolve(node.subname);
      if (subTarget !== undefined) {
        node.subname = subTarget;
        record(subTarget);
      }
      const newTarget = router.resolve(node.newname);
      if (newTarget !== undefined) {
        node.newname = newTarget;
        record(newTarget);
      }
    }
  };
}

/**
 * Apply role renaming to a SQL string: parse -> walk -> deparse. Role names in
 * PL/pgSQL / `LANGUAGE sql` bodies are string literals (e.g. inside dynamic
 * `EXECUTE`) and are intentionally not rewritten — see the module docs on why
 * arbitrary string contents are out of scope.
 */
export function transformRoles(
  sql: string,
  router: RoleRouter | RoleRouteSpec | Map<string, string>
): { sql: string; result: RoleTransformResult } {
  const resolved = RoleRouter.from(router);
  const result = createRoleResult();

  const out = transformSync(sql, (ctx: any) => {
    const stmts: any[] = ctx.sql?.stmts ?? [];
    const visitor = createRoleVisitor(resolved, result);
    for (const stmt of stmts) {
      if (stmt?.stmt) walkSql(stmt.stmt, visitor);
    }
  }, { hydrate: true, pretty: true });

  return { sql: out, result };
}
