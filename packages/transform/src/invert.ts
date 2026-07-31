/**
 * Revert/verify generation from statement facts.
 *
 * Given the classified facts of a deploy script ({@link classifyStatements}),
 * derive:
 *
 * - {@link revertFor} — the mechanical inverse script: DROP / REVOKE /
 *   DISABLE statements in **reverse topological order** of the statement
 *   dependency graph, so dependents are dropped before their dependencies
 *   and no CASCADE is ever needed. Inverses are built as AST nodes and
 *   deparsed — never string-templated. Statements with no derivable inverse
 *   (dynamic SQL, ALTER ... SET with unknown prior value, arbitrary DML)
 *   emit a `-- revert not derivable: <reason>` comment plus a warning; the
 *   generator never guesses.
 * - {@link verifyFor} — an existence check per created object, one
 *   statement per check, each raising on failure via the division idiom
 *   `SELECT 1/(CASE WHEN <exists> THEN 1 ELSE 0 END)`. Checks use
 *   `to_regclass` / `to_regprocedure` / `to_regtype` where a reg* cast
 *   exists, catalog lookups (pg_policies, pg_trigger, pg_extension,
 *   pg_roles, information_schema) for the rest, and
 *   `has_table_privilege` / `has_function_privilege` /
 *   `has_schema_privilege` for grants.
 */
import { QuoteUtils } from '@pgsql/quotes';
import { Deparser } from 'plpgsql-parser';

import { StatementFacts } from './facts';
import { buildStatementGraph } from './graph';

/** A generated script plus non-fatal notes about what could not be derived. */
export interface GeneratedScript {
  sql: string;
  warnings: string[];
}

type AnyNode = Record<string, any>;

/** One emitted piece: a deparsable AST statement or a bare comment line. */
type Emitted =
  | { stmt: AnyNode }
  | { comment: string };

const lit = (value: string): string => QuoteUtils.escape(value);

/** Render a possibly schema-qualified name as quoted SQL text. */
const qname = (schema: string | null | undefined, name: string): string =>
  QuoteUtils.quoteQualifiedIdentifier(schema ?? null, name);

const strNode = (sval: string): AnyNode => ({ String: { sval } });

const nameItems = (rel: AnyNode): AnyNode[] => {
  const items: AnyNode[] = [];
  if (rel.schemaname) items.push(strNode(rel.schemaname));
  items.push(strNode(rel.relname));
  return items;
};

const dropStmt = (removeType: string, objects: AnyNode[]): AnyNode => ({
  DropStmt: { removeType, objects, behavior: 'DROP_RESTRICT' }
});

/** Input parameter modes that participate in a function's drop signature. */
const SIGNATURE_MODES = new Set([
  'FUNC_PARAM_IN',
  'FUNC_PARAM_INOUT',
  'FUNC_PARAM_VARIADIC',
  'FUNC_PARAM_DEFAULT'
]);

/** The `ObjectWithArgs` naming a function with its input signature. */
function functionObject(node: AnyNode): AnyNode {
  const objargs = (node.parameters ?? [])
    .map((p: AnyNode) => p?.FunctionParameter)
    .filter((p: AnyNode) => p && (p.mode === undefined || SIGNATURE_MODES.has(p.mode)))
    .map((p: AnyNode) => ({ TypeName: p.argType }));
  return {
    ObjectWithArgs: {
      objname: node.funcname,
      objargs,
      args_unspecified: false
    }
  };
}

/** Deparse a function's input signature as `schema.name(type, ...)` text. */
function functionSignatureText(node: AnyNode): string {
  const parts = (node.funcname ?? [])
    .map((n: AnyNode) => n?.String?.sval)
    .filter((s: any) => typeof s === 'string');
  const name = parts.length > 1
    ? qname(parts[parts.length - 2], parts[parts.length - 1])
    : qname(null, parts[0] ?? '');
  const args = (node.parameters ?? [])
    .map((p: AnyNode) => p?.FunctionParameter)
    .filter((p: AnyNode) => p && (p.mode === undefined || SIGNATURE_MODES.has(p.mode)))
    .map((p: AnyNode) => Deparser.deparse({ TypeName: p.argType }));
  return `${name}(${args.join(', ')})`;
}

/** Deep-clone an AST node so generation never mutates the input facts. */
const clone = <T>(node: T): T => JSON.parse(JSON.stringify(node));

/**
 * Invert one classified statement into its revert statements, or a
 * not-derivable reason. Returns `null` for statements that need no revert
 * of their own (currently none — everything either inverts or warns).
 */
function invertStatement(facts: StatementFacts, warnings: string[]): Emitted[] {
  const node = facts.stmt?.[facts.nodeTag];
  const notDerivable = (reason: string): Emitted[] => {
    warnings.push(`revert not derivable: ${reason}`);
    return [{ comment: `-- revert not derivable: ${reason}` }];
  };
  if (!node) {
    return notDerivable(`no AST available for ${facts.nodeTag}`);
  }

  switch (facts.nodeTag) {
    case 'CreateSchemaStmt':
      return [{ stmt: dropStmt('OBJECT_SCHEMA', [strNode(node.schemaname)]) }];
    case 'CreateStmt':
      return [{ stmt: dropStmt('OBJECT_TABLE', [{ List: { items: nameItems(node.relation) } }]) }];
    case 'ViewStmt':
      return [{ stmt: dropStmt('OBJECT_VIEW', [{ List: { items: nameItems(node.view) } }]) }];
    case 'IndexStmt': {
      const items: AnyNode[] = [];
      if (node.relation?.schemaname) items.push(strNode(node.relation.schemaname));
      items.push(strNode(node.idxname));
      return [{ stmt: dropStmt('OBJECT_INDEX', [{ List: { items } }]) }];
    }
    case 'CreateSeqStmt':
      return [{ stmt: dropStmt('OBJECT_SEQUENCE', [{ List: { items: nameItems(node.sequence) } }]) }];
    case 'CompositeTypeStmt':
      return [{
        stmt: dropStmt('OBJECT_TYPE', [{ TypeName: { names: nameItems(node.typevar), typemod: -1 } }])
      }];
    case 'CreateEnumStmt':
    case 'CreateRangeStmt':
      return [{
        stmt: dropStmt('OBJECT_TYPE', [{ TypeName: { names: clone(node.typeName), typemod: -1 } }])
      }];
    case 'CreateDomainStmt':
      return [{
        stmt: dropStmt('OBJECT_DOMAIN', [{ TypeName: { names: clone(node.domainname), typemod: -1 } }])
      }];
    case 'CreateFunctionStmt':
      return [{
        stmt: dropStmt(
          node.is_procedure ? 'OBJECT_PROCEDURE' : 'OBJECT_FUNCTION',
          [clone(functionObject(node))]
        )
      }];
    case 'CreateTrigStmt': {
      const items = [...nameItems(node.relation), strNode(node.trigname)];
      return [{ stmt: dropStmt('OBJECT_TRIGGER', [{ List: { items } }]) }];
    }
    case 'CreatePolicyStmt': {
      const items = [...nameItems(node.table), strNode(node.policy_name)];
      return [{ stmt: dropStmt('OBJECT_POLICY', [{ List: { items } }]) }];
    }
    case 'CreateExtensionStmt':
      return [{ stmt: dropStmt('OBJECT_EXTENSION', [strNode(node.extname)]) }];
    case 'CreateRoleStmt':
      return [{
        stmt: {
          DropRoleStmt: {
            roles: [{ RoleSpec: { roletype: 'ROLESPEC_CSTRING', rolename: node.role } }]
          }
        }
      }];
    case 'GrantStmt': {
      if (node.is_grant !== true) {
        return notDerivable('REVOKE has no mechanical inverse (prior grants unknown)');
      }
      const revoke = clone(node);
      delete revoke.is_grant;
      delete revoke.grant_option;
      delete revoke.grantor;
      return [{ stmt: { GrantStmt: revoke } }];
    }
    case 'GrantRoleStmt': {
      if (node.is_grant !== true) {
        return notDerivable('REVOKE has no mechanical inverse (prior grants unknown)');
      }
      const revoke = clone(node);
      delete revoke.is_grant;
      delete revoke.opt;
      delete revoke.grantor;
      return [{ stmt: { GrantRoleStmt: revoke } }];
    }
    case 'CommentStmt': {
      const nulled = clone(node);
      delete nulled.comment;
      return [{ stmt: { CommentStmt: nulled } }];
    }
    case 'AlterTableStmt':
      return invertAlterTable(node, warnings);
    case 'InsertStmt':
    case 'UpdateStmt':
    case 'DeleteStmt':
      return notDerivable('DML is not mechanically invertible');
    default:
      return notDerivable(`no inverse known for ${facts.nodeTag}`);
  }
}

/**
 * Invert an ALTER TABLE statement command by command, in reverse command
 * order. Each invertible command becomes its own single-command ALTER so
 * partial derivability degrades per command, not per statement.
 */
function invertAlterTable(node: AnyNode, warnings: string[]): Emitted[] {
  const out: Emitted[] = [];
  const relation = clone(node.relation);
  const table = qname(node.relation?.schemaname, node.relation?.relname ?? '?');

  const alterWith = (cmd: AnyNode): Emitted => ({
    stmt: {
      AlterTableStmt: {
        objtype: 'OBJECT_TABLE',
        relation: clone(relation),
        cmds: [{ AlterTableCmd: cmd }]
      }
    }
  });
  const notDerivable = (reason: string): Emitted => {
    warnings.push(`revert not derivable: ${reason}`);
    return { comment: `-- revert not derivable: ${reason}` };
  };

  const cmds: AnyNode[] = [...(node.cmds ?? [])].reverse();
  for (const wrapped of cmds) {
    const cmd = wrapped?.AlterTableCmd;
    if (!cmd) continue;
    switch (cmd.subtype) {
      case 'AT_AddColumn':
        out.push(alterWith({
          subtype: 'AT_DropColumn',
          name: cmd.def?.ColumnDef?.colname,
          behavior: 'DROP_RESTRICT'
        }));
        break;
      case 'AT_AddConstraint': {
        const conname = cmd.def?.Constraint?.conname;
        if (!conname) {
          out.push(notDerivable(`unnamed constraint on ${table} (Postgres assigns the name at deploy time)`));
          break;
        }
        out.push(alterWith({
          subtype: 'AT_DropConstraint',
          name: conname,
          behavior: 'DROP_RESTRICT'
        }));
        break;
      }
      case 'AT_EnableRowSecurity':
        out.push(alterWith({ subtype: 'AT_DisableRowSecurity' }));
        break;
      case 'AT_ForceRowSecurity':
        out.push(alterWith({ subtype: 'AT_NoForceRowSecurity' }));
        break;
      default:
        out.push(notDerivable(`ALTER TABLE ${table} ${cmd.subtype} (prior state unknown)`));
    }
  }
  return out;
}

/**
 * Derive the revert script for a classified deploy script: mechanical
 * inverses in reverse topological order of the statement dependency graph.
 *
 * Reverse topo order means every object is dropped before anything it
 * depends on, so drops never need CASCADE. Statements with no derivable
 * inverse contribute a `-- revert not derivable` comment and a warning.
 */
export function revertFor(facts: StatementFacts[]): GeneratedScript {
  const warnings: string[] = [];
  const graph = buildStatementGraph(facts);
  const reverseOrder = [...graph.order].reverse();

  const pieces: string[] = [];
  for (const i of reverseOrder) {
    for (const emitted of invertStatement(facts[i], warnings)) {
      if ('stmt' in emitted) {
        pieces.push(`${Deparser.deparse(emitted.stmt)};`);
      } else {
        pieces.push(emitted.comment);
      }
    }
  }
  return { sql: pieces.join('\n\n'), warnings };
}

/** Wrap an existence condition in the raise-on-failure division idiom. */
const check = (condition: string): string =>
  `SELECT 1/(CASE WHEN ${condition} THEN 1 ELSE 0 END);`;

/** The verify checks for one classified statement. */
function verifyStatement(facts: StatementFacts, warnings: string[]): string[] {
  const node = facts.stmt?.[facts.nodeTag];
  const notDerivable = (reason: string): string[] => {
    warnings.push(`verify not derivable: ${reason}`);
    return [];
  };
  if (!node) {
    return notDerivable(`no AST available for ${facts.nodeTag}`);
  }

  switch (facts.nodeTag) {
    case 'CreateSchemaStmt':
      return [check(
        `EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = ${lit(node.schemaname)})`
      )];
    case 'CreateStmt':
      return [check(`to_regclass(${lit(qname(node.relation.schemaname, node.relation.relname))}) IS NOT NULL`)];
    case 'ViewStmt':
      return [check(`to_regclass(${lit(qname(node.view.schemaname, node.view.relname))}) IS NOT NULL`)];
    case 'CreateSeqStmt':
      return [check(`to_regclass(${lit(qname(node.sequence.schemaname, node.sequence.relname))}) IS NOT NULL`)];
    case 'IndexStmt':
      return [check(`to_regclass(${lit(qname(node.relation?.schemaname, node.idxname))}) IS NOT NULL`)];
    case 'CompositeTypeStmt':
      return [check(`to_regtype(${lit(qname(node.typevar.schemaname, node.typevar.relname))}) IS NOT NULL`)];
    case 'CreateEnumStmt':
    case 'CreateRangeStmt': {
      const created = facts.creates[0];
      if (!created) return notDerivable(`no created type recorded for ${facts.nodeTag}`);
      return [check(`to_regtype(${lit(qname(created.schema, created.name))}) IS NOT NULL`)];
    }
    case 'CreateDomainStmt': {
      const created = facts.creates[0];
      if (!created) return notDerivable('no created domain recorded');
      return [check(`to_regtype(${lit(qname(created.schema, created.name))}) IS NOT NULL`)];
    }
    case 'CreateFunctionStmt':
      return [check(`to_regprocedure(${lit(functionSignatureText(node))}) IS NOT NULL`)];
    case 'CreateTrigStmt': {
      const table = qname(node.relation.schemaname, node.relation.relname);
      return [check(
        `EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = ${lit(node.trigname)} ` +
        `AND tgrelid = ${lit(table)}::regclass AND NOT tgisinternal)`
      )];
    }
    case 'CreatePolicyStmt': {
      const conds = [`policyname = ${lit(node.policy_name)}`, `tablename = ${lit(node.table.relname)}`];
      if (node.table.schemaname) conds.push(`schemaname = ${lit(node.table.schemaname)}`);
      return [check(`EXISTS (SELECT 1 FROM pg_policies WHERE ${conds.join(' AND ')})`)];
    }
    case 'CreateExtensionStmt':
      return [check(`EXISTS (SELECT 1 FROM pg_extension WHERE extname = ${lit(node.extname)})`)];
    case 'CreateRoleStmt':
      return [check(`EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${lit(node.role)})`)];
    case 'GrantStmt':
      return verifyGrant(node, warnings);
    case 'GrantRoleStmt': {
      if (node.is_grant !== true) return [];
      const out: string[] = [];
      for (const granted of node.granted_roles ?? []) {
        const roleName = granted?.AccessPriv?.priv_name;
        if (!roleName) continue;
        for (const grantee of node.grantee_roles ?? []) {
          const member = grantee?.RoleSpec?.rolename;
          if (!member) continue;
          out.push(check(
            `EXISTS (SELECT 1 FROM pg_auth_members m ` +
            `JOIN pg_roles granted ON granted.oid = m.roleid ` +
            `JOIN pg_roles member ON member.oid = m.member ` +
            `WHERE granted.rolname = ${lit(roleName)} AND member.rolname = ${lit(member)})`
          ));
        }
      }
      return out;
    }
    case 'AlterTableStmt':
      return verifyAlterTable(node, warnings);
    case 'CommentStmt':
    case 'InsertStmt':
    case 'UpdateStmt':
    case 'DeleteStmt':
      // No object comes into existence; nothing to verify.
      return [];
    default:
      return notDerivable(`no existence check known for ${facts.nodeTag}`);
  }
}

/** Privilege checks for a GRANT: one per (grantee, privilege, object). */
function verifyGrant(node: AnyNode, warnings: string[]): string[] {
  if (node.is_grant !== true) return [];

  const privNames: string[] = (node.privileges ?? [])
    .map((p: AnyNode) => p?.AccessPriv?.priv_name)
    .filter((s: any) => typeof s === 'string');
  if (privNames.length === 0) {
    warnings.push('verify not derivable: GRANT ALL expands per object type; grant privileges explicitly to verify them');
    return [];
  }

  const grantees: string[] = (node.grantees ?? [])
    .map((g: AnyNode) => {
      const spec = g?.RoleSpec;
      if (spec?.roletype === 'ROLESPEC_PUBLIC') return 'public';
      return spec?.rolename;
    })
    .filter((s: any) => typeof s === 'string');

  const out: string[] = [];
  for (const grantee of grantees) {
    for (const priv of privNames) {
      const privilege = priv.toUpperCase();
      switch (node.objtype) {
        case 'OBJECT_TABLE':
        case 'OBJECT_SEQUENCE':
          for (const obj of node.objects ?? []) {
            const rel = obj?.RangeVar;
            if (!rel) continue;
            out.push(check(
              `has_table_privilege(${lit(grantee)}, ${lit(qname(rel.schemaname, rel.relname))}, ${lit(privilege)})`
            ));
          }
          break;
        case 'OBJECT_FUNCTION':
        case 'OBJECT_PROCEDURE':
          for (const obj of node.objects ?? []) {
            const owa = obj?.ObjectWithArgs;
            if (!owa) continue;
            const parts = (owa.objname ?? [])
              .map((n: AnyNode) => n?.String?.sval)
              .filter((s: any) => typeof s === 'string');
            const name = parts.length > 1
              ? qname(parts[parts.length - 2], parts[parts.length - 1])
              : qname(null, parts[0] ?? '');
            const args = (owa.objargs ?? []).map((t: AnyNode) => Deparser.deparse(t));
            out.push(check(
              `has_function_privilege(${lit(grantee)}, ${lit(`${name}(${args.join(', ')})`)}, ${lit(privilege)})`
            ));
          }
          break;
        case 'OBJECT_SCHEMA':
          for (const obj of node.objects ?? []) {
            const schema = obj?.String?.sval;
            if (!schema) continue;
            out.push(check(
              `has_schema_privilege(${lit(grantee)}, ${lit(qname(null, schema))}, ${lit(privilege)})`
            ));
          }
          break;
        default:
          warnings.push(`verify not derivable: GRANT on ${node.objtype ?? 'unknown object type'}`);
      }
    }
  }
  return out;
}

/** Existence checks for ALTER TABLE commands (columns, constraints, RLS). */
function verifyAlterTable(node: AnyNode, warnings: string[]): string[] {
  const rel = node.relation;
  const out: string[] = [];
  const table = qname(rel?.schemaname, rel?.relname ?? '?');

  const relCondition = (extra: string): string => {
    const conds = [`c.relname = ${lit(rel.relname)}`];
    if (rel.schemaname) conds.push(`n.nspname = ${lit(rel.schemaname)}`);
    return `EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE ${conds.join(' AND ')} AND ${extra})`;
  };

  for (const wrapped of node.cmds ?? []) {
    const cmd = wrapped?.AlterTableCmd;
    if (!cmd) continue;
    switch (cmd.subtype) {
      case 'AT_AddColumn': {
        const colname = cmd.def?.ColumnDef?.colname;
        if (!colname) break;
        const conds = [`table_name = ${lit(rel.relname)}`, `column_name = ${lit(colname)}`];
        if (rel.schemaname) conds.push(`table_schema = ${lit(rel.schemaname)}`);
        out.push(check(`EXISTS (SELECT 1 FROM information_schema.columns WHERE ${conds.join(' AND ')})`));
        break;
      }
      case 'AT_AddConstraint': {
        const conname = cmd.def?.Constraint?.conname;
        if (!conname) {
          warnings.push(`verify not derivable: unnamed constraint on ${table} (Postgres assigns the name at deploy time)`);
          break;
        }
        const conds = [`table_name = ${lit(rel.relname)}`, `constraint_name = ${lit(conname)}`];
        if (rel.schemaname) conds.push(`table_schema = ${lit(rel.schemaname)}`);
        out.push(check(`EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE ${conds.join(' AND ')})`));
        break;
      }
      case 'AT_EnableRowSecurity':
        out.push(check(relCondition('c.relrowsecurity')));
        break;
      case 'AT_ForceRowSecurity':
        out.push(check(relCondition('c.relforcerowsecurity')));
        break;
      default:
        // Nothing verifiable comes into existence.
        break;
    }
  }
  return out;
}

/**
 * Derive the verify script for a classified deploy script: one existence
 * check per created object, in source order (existence checks are order
 * independent; source order keeps output stable). Each check raises a
 * division-by-zero error when the object is missing. Statements whose
 * effect cannot be checked mechanically add a warning and emit nothing.
 */
export function verifyFor(facts: StatementFacts[]): GeneratedScript {
  const warnings: string[] = [];
  const pieces: string[] = [];
  for (const fact of facts) {
    pieces.push(...verifyStatement(fact, warnings));
  }
  return { sql: pieces.join('\n\n'), warnings };
}
