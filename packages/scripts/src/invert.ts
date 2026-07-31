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
import { buildStatementGraph, StatementFacts } from '@pgsql/transform';
import { Deparser, parseSql } from 'plpgsql-parser';

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

/** Render a name list (`[{ String: { sval } }, ...]`) as quoted SQL text. */
function nameListText(names: AnyNode[] | undefined): string {
  const parts = (names ?? [])
    .map((n: AnyNode) => n?.String?.sval)
    .filter((s: any) => typeof s === 'string');
  return parts.length > 1
    ? qname(parts[parts.length - 2], parts[parts.length - 1])
    : qname(null, parts[0] ?? '');
}

/** The `FunctionParameter` args of a `DefineStmt` (aggregates). */
const defineArgs = (node: AnyNode): AnyNode[] =>
  (node.args?.[0]?.List?.items ?? [])
    .map((p: AnyNode) => p?.FunctionParameter)
    .filter(Boolean);

/** DefElem lookup by name within a definition list. */
const defElem = (definition: AnyNode[] | undefined, name: string): AnyNode | undefined =>
  (definition ?? []).map((d: AnyNode) => d?.DefElem).find((d: AnyNode) => d?.defname === name);

/**
 * Invert one classified statement into its revert statements, or a
 * not-derivable reason. Returns `null` for statements that need no revert
 * of their own (currently none — everything either inverts or warns).
 */
function emitInverse(facts: StatementFacts, warnings: string[]): Emitted[] {
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
    case 'CreateTableAsStmt': {
      if (node.objtype !== 'OBJECT_MATVIEW' && node.objtype !== 'OBJECT_TABLE') {
        return notDerivable(`no inverse known for CREATE ... AS with objtype ${node.objtype}`);
      }
      return [{
        stmt: dropStmt(node.objtype, [{ List: { items: nameItems(node.into.rel) } }])
      }];
    }
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
    case 'CreateForeignServerStmt':
      return [{ stmt: dropStmt('OBJECT_FOREIGN_SERVER', [strNode(node.servername)]) }];
    case 'CreateForeignTableStmt':
      return [{
        stmt: dropStmt('OBJECT_FOREIGN_TABLE', [{ List: { items: nameItems(node.base.relation) } }])
      }];
    case 'CreateUserMappingStmt':
      return [{
        stmt: {
          DropUserMappingStmt: {
            user: clone(node.user),
            servername: node.servername
          }
        }
      }];
    case 'DefineStmt':
      return invertDefine(node, notDerivable);
    case 'CreateCastStmt':
      return [{
        stmt: dropStmt('OBJECT_CAST', [
          { List: { items: [{ TypeName: clone(node.sourcetype) }, { TypeName: clone(node.targettype) }] } }
        ])
      }];
    case 'CreatePublicationStmt':
      return [{ stmt: dropStmt('OBJECT_PUBLICATION', [strNode(node.pubname)]) }];
    case 'CreateSubscriptionStmt':
      return [{
        stmt: { DropSubscriptionStmt: { subname: node.subname, behavior: 'DROP_RESTRICT' } }
      }];
    case 'CreateStatsStmt':
      return [{
        stmt: dropStmt('OBJECT_STATISTIC_EXT', [{ List: { items: clone(node.defnames) } }])
      }];
    case 'CreateEventTrigStmt':
      return [{ stmt: dropStmt('OBJECT_EVENT_TRIGGER', [strNode(node.trigname)]) }];
    case 'RuleStmt': {
      const items = [...nameItems(node.relation), strNode(node.rulename)];
      return [{ stmt: dropStmt('OBJECT_RULE', [{ List: { items } }]) }];
    }
    case 'AlterEnumStmt':
      return notDerivable(
        `enum value ${JSON.stringify(node.newVal)} cannot be dropped (Postgres has no DROP VALUE)`
      );
    case 'AlterDefaultPrivilegesStmt': {
      if (node.action?.is_grant !== true) {
        return notDerivable('ALTER DEFAULT PRIVILEGES REVOKE has no mechanical inverse (prior grants unknown)');
      }
      const inverted = clone(node);
      delete inverted.action.is_grant;
      delete inverted.action.grant_option;
      delete inverted.action.grantor;
      return [{ stmt: { AlterDefaultPrivilegesStmt: inverted } }];
    }
    case 'SecLabelStmt': {
      const nulled = clone(node);
      delete nulled.label;
      return [{ stmt: { SecLabelStmt: nulled } }];
    }
    case 'CreateFdwStmt':
      return [{ stmt: dropStmt('OBJECT_FDW', [strNode(node.fdwname)]) }];
    case 'CreateConversionStmt':
      return [{
        stmt: dropStmt('OBJECT_CONVERSION', [{ List: { items: clone(node.conversion_name) } }])
      }];
    case 'CreateAmStmt':
      return [{ stmt: dropStmt('OBJECT_ACCESS_METHOD', [strNode(node.amname)]) }];
    case 'CreateTransformStmt':
      return [{
        stmt: dropStmt('OBJECT_TRANSFORM', [
          { List: { items: [{ TypeName: clone(node.type_name) }, strNode(node.lang)] } }
        ])
      }];
    case 'CreateOpClassStmt':
      return [{
        stmt: dropStmt('OBJECT_OPCLASS', [
          { List: { items: [strNode(node.amname), ...clone(node.opclassname)] } }
        ])
      }];
    case 'CreateOpFamilyStmt':
      return [{
        stmt: dropStmt('OBJECT_OPFAMILY', [
          { List: { items: [strNode(node.amname), ...clone(node.opfamilyname)] } }
        ])
      }];
    case 'CreateTableSpaceStmt':
      return [{ stmt: { DropTableSpaceStmt: { tablespacename: node.tablespacename } } }];
    case 'RenameStmt':
      return invertRename(node, notDerivable);
    case 'AlterObjectSchemaStmt':
      return invertSetSchema(node, notDerivable);
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

/** Inverses for `DefineStmt` objects: collations, aggregates, operators. */
function invertDefine(node: AnyNode, notDerivable: (reason: string) => Emitted[]): Emitted[] {
  switch (node.kind) {
    case 'OBJECT_COLLATION':
      return [{
        stmt: dropStmt('OBJECT_COLLATION', [{ List: { items: clone(node.defnames) } }])
      }];
    case 'OBJECT_AGGREGATE': {
      const objargs = defineArgs(node).map((p: AnyNode) => ({ TypeName: clone(p.argType) }));
      return [{
        stmt: dropStmt('OBJECT_AGGREGATE', [{
          ObjectWithArgs: { objname: clone(node.defnames), objargs, args_unspecified: false }
        }])
      }];
    }
    case 'OBJECT_OPERATOR': {
      const left = defElem(node.definition, 'leftarg');
      const right = defElem(node.definition, 'rightarg');
      if (!left?.arg?.TypeName || !right?.arg?.TypeName) {
        return notDerivable('prefix operators are not supported (binary LEFTARG/RIGHTARG required)');
      }
      return [{
        stmt: dropStmt('OBJECT_OPERATOR', [{
          ObjectWithArgs: {
            objname: clone(node.defnames),
            objargs: [{ TypeName: clone(left.arg.TypeName) }, { TypeName: clone(right.arg.TypeName) }]
          }
        }])
      }];
    }
    case 'OBJECT_TSCONFIGURATION':
    case 'OBJECT_TSDICTIONARY':
    case 'OBJECT_TSPARSER':
    case 'OBJECT_TSTEMPLATE':
      return [{
        stmt: dropStmt(node.kind, [{ List: { items: clone(node.defnames) } }])
      }];
    default:
      return notDerivable(`no inverse known for CREATE (DefineStmt) with kind ${node.kind}`);
  }
}

/**
 * Invert a RENAME by swapping the two names the statement already carries:
 * `ALTER ... RENAME old TO new` becomes `ALTER ... RENAME new TO old`.
 */
function invertRename(node: AnyNode, notDerivable: (reason: string) => Emitted[]): Emitted[] {
  const inverted = clone(node);
  switch (node.renameType) {
    case 'OBJECT_TABLE':
    case 'OBJECT_INDEX':
    case 'OBJECT_SEQUENCE':
    case 'OBJECT_VIEW':
    case 'OBJECT_MATVIEW':
    case 'OBJECT_FOREIGN_TABLE':
      inverted.relation.relname = node.newname;
      inverted.newname = node.relation.relname;
      break;
    case 'OBJECT_COLUMN':
    case 'OBJECT_SCHEMA':
      inverted.subname = node.newname;
      inverted.newname = node.subname;
      break;
    case 'OBJECT_TYPE':
    case 'OBJECT_DOMAIN': {
      const items = inverted.object?.List?.items;
      if (!items?.length) return notDerivable(`RENAME ${node.renameType} without a qualified name`);
      inverted.newname = items[items.length - 1].String.sval;
      items[items.length - 1] = strNode(node.newname);
      break;
    }
    case 'OBJECT_FUNCTION':
    case 'OBJECT_PROCEDURE':
    case 'OBJECT_AGGREGATE': {
      const objname = inverted.object?.ObjectWithArgs?.objname;
      if (!objname?.length) return notDerivable(`RENAME ${node.renameType} without a function name`);
      inverted.newname = objname[objname.length - 1].String.sval;
      objname[objname.length - 1] = strNode(node.newname);
      break;
    }
    default:
      return notDerivable(`no inverse known for RENAME ${node.renameType}`);
  }
  return [{ stmt: { RenameStmt: inverted } }];
}

/**
 * Invert a SET SCHEMA by moving the object back: the statement carries both
 * the old (qualified name) and new schema, so the swap is mechanical. An
 * unqualified source name would leave the original schema unknown — warned.
 */
function invertSetSchema(node: AnyNode, notDerivable: (reason: string) => Emitted[]): Emitted[] {
  const inverted = clone(node);
  if (node.relation) {
    if (!node.relation.schemaname) {
      return notDerivable('SET SCHEMA on an unqualified name (original schema unknown)');
    }
    inverted.relation.schemaname = node.newschema;
    inverted.newschema = node.relation.schemaname;
    return [{ stmt: { AlterObjectSchemaStmt: inverted } }];
  }
  const objname = inverted.object?.ObjectWithArgs?.objname ?? inverted.object?.List?.items;
  if (!objname || objname.length < 2) {
    return notDerivable('SET SCHEMA on an unqualified name (original schema unknown)');
  }
  inverted.newschema = objname[objname.length - 2].String.sval;
  objname[objname.length - 2] = strNode(node.newschema);
  return [{ stmt: { AlterObjectSchemaStmt: inverted } }];
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
      case 'AT_AttachPartition': {
        const partition = cmd.def?.PartitionCmd?.name;
        if (!partition) {
          out.push(notDerivable(`ATTACH PARTITION on ${table} without a partition name`));
          break;
        }
        out.push(alterWith({
          subtype: 'AT_DetachPartition',
          def: { PartitionCmd: { name: { RangeVar: clone(partition) } } },
          behavior: 'DROP_RESTRICT'
        }));
        break;
      }
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
    for (const emitted of emitInverse(facts[i], warnings)) {
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
function emitChecks(facts: StatementFacts, warnings: string[]): string[] {
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
    case 'CreateTableAsStmt': {
      if (node.objtype !== 'OBJECT_MATVIEW' && node.objtype !== 'OBJECT_TABLE') {
        return notDerivable(`no existence check known for CREATE ... AS with objtype ${node.objtype}`);
      }
      return [check(`to_regclass(${lit(qname(node.into.rel.schemaname, node.into.rel.relname))}) IS NOT NULL`)];
    }
    case 'CreateForeignServerStmt':
      return [check(`EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = ${lit(node.servername)})`)];
    case 'CreateForeignTableStmt':
      return [check(
        `to_regclass(${lit(qname(node.base.relation.schemaname, node.base.relation.relname))}) IS NOT NULL`
      )];
    case 'CreateUserMappingStmt': {
      const user = node.user?.roletype === 'ROLESPEC_PUBLIC' ? 'public' : node.user?.rolename;
      if (!user) return notDerivable('CREATE USER MAPPING without a resolvable user');
      return [check(
        `EXISTS (SELECT 1 FROM pg_user_mappings WHERE srvname = ${lit(node.servername)} ` +
        `AND usename = ${lit(user)})`
      )];
    }
    case 'DefineStmt':
      return verifyDefine(node, notDerivable);
    case 'CreateCastStmt': {
      const source = Deparser.deparse({ TypeName: node.sourcetype });
      const target = Deparser.deparse({ TypeName: node.targettype });
      return [check(
        `EXISTS (SELECT 1 FROM pg_cast WHERE castsource = ${lit(source)}::regtype ` +
        `AND casttarget = ${lit(target)}::regtype)`
      )];
    }
    case 'CreatePublicationStmt':
      return [check(`EXISTS (SELECT 1 FROM pg_publication WHERE pubname = ${lit(node.pubname)})`)];
    case 'CreateSubscriptionStmt':
      return [check(`EXISTS (SELECT 1 FROM pg_subscription WHERE subname = ${lit(node.subname)})`)];
    case 'CreateStatsStmt':
      return [check(
        `EXISTS (SELECT 1 FROM pg_statistic_ext s JOIN pg_namespace n ON n.oid = s.stxnamespace ` +
        `WHERE s.stxname = ${lit(defNameOnly(node.defnames))}${defNamespaceCond(node.defnames)})`
      )];
    case 'CreateEventTrigStmt':
      return [check(`EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = ${lit(node.trigname)})`)];
    case 'RuleStmt': {
      const conds = [`rulename = ${lit(node.rulename)}`, `tablename = ${lit(node.relation.relname)}`];
      if (node.relation.schemaname) conds.push(`schemaname = ${lit(node.relation.schemaname)}`);
      return [check(`EXISTS (SELECT 1 FROM pg_rules WHERE ${conds.join(' AND ')})`)];
    }
    case 'AlterEnumStmt': {
      if (!node.newVal) return notDerivable('ALTER TYPE without ADD VALUE has nothing to verify');
      return [check(
        `EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = ${lit(nameListText(node.typeName))}::regtype ` +
        `AND enumlabel = ${lit(node.newVal)})`
      )];
    }
    case 'AlterDefaultPrivilegesStmt':
      return verifyDefaultPrivileges(node, warnings);
    case 'CreateFdwStmt':
      return [check(`EXISTS (SELECT 1 FROM pg_foreign_data_wrapper WHERE fdwname = ${lit(node.fdwname)})`)];
    case 'CreateConversionStmt':
      return [check(
        `EXISTS (SELECT 1 FROM pg_conversion c JOIN pg_namespace n ON n.oid = c.connamespace ` +
        `WHERE c.conname = ${lit(defNameOnly(node.conversion_name))}${defNamespaceCond(node.conversion_name)})`
      )];
    case 'CreateAmStmt':
      return [check(`EXISTS (SELECT 1 FROM pg_am WHERE amname = ${lit(node.amname)})`)];
    case 'CreateTransformStmt': {
      const type = Deparser.deparse({ TypeName: node.type_name });
      return [check(
        `EXISTS (SELECT 1 FROM pg_transform t JOIN pg_language l ON l.oid = t.trflang ` +
        `WHERE t.trftype = ${lit(type)}::regtype AND l.lanname = ${lit(node.lang)})`
      )];
    }
    case 'CreateOpClassStmt':
      return [check(
        `EXISTS (SELECT 1 FROM pg_opclass c JOIN pg_am am ON am.oid = c.opcmethod ` +
        `JOIN pg_namespace n ON n.oid = c.opcnamespace ` +
        `WHERE c.opcname = ${lit(defNameOnly(node.opclassname))} AND am.amname = ${lit(node.amname)}` +
        `${defNamespaceCond(node.opclassname)})`
      )];
    case 'CreateOpFamilyStmt':
      return [check(
        `EXISTS (SELECT 1 FROM pg_opfamily f JOIN pg_am am ON am.oid = f.opfmethod ` +
        `JOIN pg_namespace n ON n.oid = f.opfnamespace ` +
        `WHERE f.opfname = ${lit(defNameOnly(node.opfamilyname))} AND am.amname = ${lit(node.amname)}` +
        `${defNamespaceCond(node.opfamilyname)})`
      )];
    case 'CreateTableSpaceStmt':
      return [check(`EXISTS (SELECT 1 FROM pg_tablespace WHERE spcname = ${lit(node.tablespacename)})`)];
    case 'RenameStmt':
      return verifyRename(node, notDerivable);
    case 'AlterObjectSchemaStmt':
      return verifySetSchema(node, notDerivable);
    case 'SecLabelStmt':
      // Like comments: metadata only, nothing comes into existence.
      return [];
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

/** Last element of a DefineStmt name list. */
const defNameOnly = (defnames: AnyNode[] | undefined): string => {
  const parts = (defnames ?? [])
    .map((n: AnyNode) => n?.String?.sval)
    .filter((s: any) => typeof s === 'string');
  return parts[parts.length - 1] ?? '';
};

/** Optional namespace condition for a qualified DefineStmt name list. */
const defNamespaceCond = (defnames: AnyNode[] | undefined): string => {
  const parts = (defnames ?? [])
    .map((n: AnyNode) => n?.String?.sval)
    .filter((s: any) => typeof s === 'string');
  return parts.length > 1 ? ` AND n.nspname = ${lit(parts[parts.length - 2])}` : '';
};

/** Existence checks for DefineStmt objects: collations, aggregates, operators. */
function verifyDefine(node: AnyNode, notDerivable: (reason: string) => string[]): string[] {
  switch (node.kind) {
    case 'OBJECT_COLLATION':
      return [check(
        `EXISTS (SELECT 1 FROM pg_collation c JOIN pg_namespace n ON n.oid = c.collnamespace ` +
        `WHERE c.collname = ${lit(defNameOnly(node.defnames))}${defNamespaceCond(node.defnames)})`
      )];
    case 'OBJECT_AGGREGATE': {
      const args = defineArgs(node).map((p: AnyNode) => Deparser.deparse({ TypeName: p.argType }));
      const signature = `${nameListText(node.defnames)}(${args.join(', ')})`;
      return [check(`to_regprocedure(${lit(signature)}) IS NOT NULL`)];
    }
    case 'OBJECT_OPERATOR': {
      const left = defElem(node.definition, 'leftarg');
      const right = defElem(node.definition, 'rightarg');
      if (!left?.arg?.TypeName || !right?.arg?.TypeName) {
        return notDerivable('prefix operators are not supported (binary LEFTARG/RIGHTARG required)');
      }
      const args = [left.arg.TypeName, right.arg.TypeName]
        .map((t: AnyNode) => Deparser.deparse({ TypeName: t }));
      // Operator names are not identifiers: never quote them.
      const parts = (node.defnames ?? [])
        .map((n: AnyNode) => n?.String?.sval)
        .filter((s: any) => typeof s === 'string');
      const op = parts[parts.length - 1] ?? '';
      const qualified = parts.length > 1 ? `${qname(null, parts[parts.length - 2])}.${op}` : op;
      return [check(`to_regoperator(${lit(`${qualified}(${args.join(', ')})`)}) IS NOT NULL`)];
    }
    case 'OBJECT_TSCONFIGURATION':
      return [check(
        `EXISTS (SELECT 1 FROM pg_ts_config c JOIN pg_namespace n ON n.oid = c.cfgnamespace ` +
        `WHERE c.cfgname = ${lit(defNameOnly(node.defnames))}${defNamespaceCond(node.defnames)})`
      )];
    case 'OBJECT_TSDICTIONARY':
      return [check(
        `EXISTS (SELECT 1 FROM pg_ts_dict d JOIN pg_namespace n ON n.oid = d.dictnamespace ` +
        `WHERE d.dictname = ${lit(defNameOnly(node.defnames))}${defNamespaceCond(node.defnames)})`
      )];
    case 'OBJECT_TSPARSER':
      return [check(
        `EXISTS (SELECT 1 FROM pg_ts_parser p JOIN pg_namespace n ON n.oid = p.prsnamespace ` +
        `WHERE p.prsname = ${lit(defNameOnly(node.defnames))}${defNamespaceCond(node.defnames)})`
      )];
    case 'OBJECT_TSTEMPLATE':
      return [check(
        `EXISTS (SELECT 1 FROM pg_ts_template t JOIN pg_namespace n ON n.oid = t.tmplnamespace ` +
        `WHERE t.tmplname = ${lit(defNameOnly(node.defnames))}${defNamespaceCond(node.defnames)})`
      )];
    default:
      return notDerivable(`no existence check known for CREATE (DefineStmt) with kind ${node.kind}`);
  }
}

/** Existence checks for RENAME: the object exists under its new name. */
function verifyRename(node: AnyNode, notDerivable: (reason: string) => string[]): string[] {
  switch (node.renameType) {
    case 'OBJECT_TABLE':
    case 'OBJECT_INDEX':
    case 'OBJECT_SEQUENCE':
    case 'OBJECT_VIEW':
    case 'OBJECT_MATVIEW':
    case 'OBJECT_FOREIGN_TABLE':
      return [check(`to_regclass(${lit(qname(node.relation.schemaname, node.newname))}) IS NOT NULL`)];
    case 'OBJECT_COLUMN': {
      const conds = [`table_name = ${lit(node.relation.relname)}`, `column_name = ${lit(node.newname)}`];
      if (node.relation.schemaname) conds.push(`table_schema = ${lit(node.relation.schemaname)}`);
      return [check(`EXISTS (SELECT 1 FROM information_schema.columns WHERE ${conds.join(' AND ')})`)];
    }
    case 'OBJECT_SCHEMA':
      return [check(
        `EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = ${lit(node.newname)})`
      )];
    case 'OBJECT_TYPE':
    case 'OBJECT_DOMAIN': {
      const items = node.object?.List?.items;
      if (!items?.length) return notDerivable(`RENAME ${node.renameType} without a qualified name`);
      const parts = items
        .map((n: AnyNode) => n?.String?.sval)
        .filter((s: any) => typeof s === 'string');
      const schema = parts.length > 1 ? parts[parts.length - 2] : null;
      return [check(`to_regtype(${lit(qname(schema, node.newname))}) IS NOT NULL`)];
    }
    case 'OBJECT_FUNCTION':
    case 'OBJECT_PROCEDURE':
    case 'OBJECT_AGGREGATE': {
      const owa = node.object?.ObjectWithArgs;
      if (!owa?.objname?.length) return notDerivable(`RENAME ${node.renameType} without a function name`);
      const parts = owa.objname
        .map((n: AnyNode) => n?.String?.sval)
        .filter((s: any) => typeof s === 'string');
      const schema = parts.length > 1 ? parts[parts.length - 2] : null;
      const args = (owa.objargs ?? []).map((t: AnyNode) => Deparser.deparse(t));
      return [check(
        `to_regprocedure(${lit(`${qname(schema, node.newname)}(${args.join(', ')})`)}) IS NOT NULL`
      )];
    }
    default:
      return notDerivable(`no existence check known for RENAME ${node.renameType}`);
  }
}

/** Existence checks for SET SCHEMA: the object exists in the new schema. */
function verifySetSchema(node: AnyNode, notDerivable: (reason: string) => string[]): string[] {
  switch (node.objectType) {
    case 'OBJECT_TABLE':
    case 'OBJECT_SEQUENCE':
    case 'OBJECT_VIEW':
    case 'OBJECT_MATVIEW':
    case 'OBJECT_FOREIGN_TABLE':
      return [check(`to_regclass(${lit(qname(node.newschema, node.relation.relname))}) IS NOT NULL`)];
    case 'OBJECT_TYPE':
    case 'OBJECT_DOMAIN': {
      const items = node.object?.List?.items;
      if (!items?.length) return notDerivable(`SET SCHEMA ${node.objectType} without a name`);
      const parts = items
        .map((n: AnyNode) => n?.String?.sval)
        .filter((s: any) => typeof s === 'string');
      return [check(`to_regtype(${lit(qname(node.newschema, parts[parts.length - 1]))}) IS NOT NULL`)];
    }
    case 'OBJECT_FUNCTION':
    case 'OBJECT_PROCEDURE':
    case 'OBJECT_AGGREGATE': {
      const owa = node.object?.ObjectWithArgs;
      if (!owa?.objname?.length) return notDerivable(`SET SCHEMA ${node.objectType} without a function name`);
      const parts = owa.objname
        .map((n: AnyNode) => n?.String?.sval)
        .filter((s: any) => typeof s === 'string');
      const args = (owa.objargs ?? []).map((t: AnyNode) => Deparser.deparse(t));
      return [check(
        `to_regprocedure(${lit(`${qname(node.newschema, parts[parts.length - 1])}(${args.join(', ')})`)}) IS NOT NULL`
      )];
    }
    default:
      return notDerivable(`no existence check known for SET SCHEMA on ${node.objectType}`);
  }
}

/**
 * The concrete privileges GRANT ALL expands to, per object type. Fixed
 * PostgreSQL knowledge, not database state.
 */
const ALL_PRIVILEGES: Record<string, string[]> = {
  OBJECT_TABLE: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'],
  OBJECT_SEQUENCE: ['USAGE', 'SELECT', 'UPDATE'],
  OBJECT_FUNCTION: ['EXECUTE'],
  OBJECT_PROCEDURE: ['EXECUTE'],
  OBJECT_SCHEMA: ['CREATE', 'USAGE'],
  OBJECT_TYPE: ['USAGE']
};

/** ACL objtype codes used by pg_default_acl.defaclobjtype. */
const DEFAULT_ACL_OBJTYPE: Record<string, string> = {
  OBJECT_TABLE: 'r',
  OBJECT_SEQUENCE: 'S',
  OBJECT_FUNCTION: 'f',
  OBJECT_TYPE: 'T',
  OBJECT_SCHEMA: 'n'
};

/** Checks for ALTER DEFAULT PRIVILEGES ... GRANT via pg_default_acl. */
function verifyDefaultPrivileges(node: AnyNode, warnings: string[]): string[] {
  const action = node.action;
  if (action?.is_grant !== true) return [];

  const objtype = DEFAULT_ACL_OBJTYPE[action.objtype];
  if (!objtype) {
    warnings.push(`verify not derivable: ALTER DEFAULT PRIVILEGES on ${action.objtype}`);
    return [];
  }

  let privNames: string[] = (action.privileges ?? [])
    .map((p: AnyNode) => p?.AccessPriv?.priv_name)
    .filter((s: any) => typeof s === 'string');
  if (privNames.length === 0) {
    // GRANT ALL: expand to the object type's full privilege list.
    privNames = ALL_PRIVILEGES[action.objtype] ?? [];
    if (privNames.length === 0) {
      warnings.push(`verify not derivable: ALTER DEFAULT PRIVILEGES GRANT ALL on ${action.objtype}`);
      return [];
    }
  }

  const grantees: string[] = (action.grantees ?? [])
    .map((g: AnyNode) => {
      const spec = g?.RoleSpec;
      if (spec?.roletype === 'ROLESPEC_PUBLIC') return 'public';
      return spec?.rolename;
    })
    .filter((s: any) => typeof s === 'string');

  const schemas: string[] = (node.options ?? [])
    .filter((o: AnyNode) => o?.DefElem?.defname === 'schemas')
    .flatMap((o: AnyNode) => o.DefElem.arg?.List?.items ?? [])
    .map((s: AnyNode) => s?.String?.sval)
    .filter((s: any) => typeof s === 'string');

  const out: string[] = [];
  for (const grantee of grantees) {
    for (const privilege of privNames) {
      const conds = [
        `d.defaclobjtype = ${lit(objtype)}`,
        `r.rolname = ${lit(grantee)}`,
        `a.privilege_type = ${lit(privilege.toUpperCase())}`
      ];
      if (schemas.length > 0) {
        conds.push(`d.defaclnamespace IN (${schemas.map(s => `to_regnamespace(${lit(qname(null, s))})`).join(', ')})`);
      }
      out.push(check(
        `EXISTS (SELECT 1 FROM pg_default_acl d, aclexplode(d.defaclacl) a ` +
        `JOIN pg_roles r ON r.oid = a.grantee WHERE ${conds.join(' AND ')})`
      ));
    }
  }
  return out;
}

/** Privilege checks for a GRANT: one per (grantee, privilege, object). */
function verifyGrant(node: AnyNode, warnings: string[]): string[] {
  if (node.is_grant !== true) return [];

  let privNames: string[] = (node.privileges ?? [])
    .map((p: AnyNode) => p?.AccessPriv?.priv_name)
    .filter((s: any) => typeof s === 'string');
  if (privNames.length === 0) {
    // GRANT ALL: expand to the object type's full privilege list.
    privNames = ALL_PRIVILEGES[node.objtype] ?? [];
    if (privNames.length === 0) {
      warnings.push(`verify not derivable: GRANT ALL on ${node.objtype ?? 'unknown object type'}`);
      return [];
    }
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
        case 'OBJECT_SEQUENCE': {
          const fn = node.objtype === 'OBJECT_SEQUENCE' ? 'has_sequence_privilege' : 'has_table_privilege';
          for (const obj of node.objects ?? []) {
            const rel = obj?.RangeVar;
            if (!rel) continue;
            out.push(check(
              `${fn}(${lit(grantee)}, ${lit(qname(rel.schemaname, rel.relname))}, ${lit(privilege)})`
            ));
          }
          break;
        }
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
      case 'AT_AttachPartition': {
        const partition = cmd.def?.PartitionCmd?.name;
        if (!partition) break;
        out.push(check(
          `EXISTS (SELECT 1 FROM pg_inherits WHERE ` +
          `inhrelid = ${lit(qname(partition.schemaname, partition.relname))}::regclass ` +
          `AND inhparent = ${lit(table)}::regclass)`
        ));
        break;
      }
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
    pieces.push(...emitChecks(fact, warnings));
  }
  return { sql: pieces.join('\n\n'), warnings };
}

/**
 * The inverse of one classified statement as raw AST nodes (each one a
 * wrapped statement node, e.g. `{ DropStmt: {...} }`), or `null` when no
 * inverse is mechanically derivable. An empty array means the statement
 * needs no revert of its own.
 *
 * This is the node-level layer under {@link revertFor}: consumers that
 * compose inverses at the AST level (semantic diffing, migration
 * generation) use this instead of round-tripping through deparsed text.
 * A statement whose inverse is only partially derivable (e.g. an ALTER
 * TABLE where one command cannot be inverted) returns `null` — partial
 * inverses are never silently produced.
 */
export function invertStatement(facts: StatementFacts): AnyNode[] | null {
  const warnings: string[] = [];
  const emitted = emitInverse(facts, warnings);
  if (warnings.length > 0) return null;
  return emitted
    .filter((e): e is { stmt: AnyNode } => 'stmt' in e)
    .map(e => e.stmt);
}

/**
 * The existence checks for one classified statement as raw AST nodes
 * (each one a wrapped `SelectStmt` using the raise-on-failure division
 * idiom), or `null` when no check is mechanically derivable. An empty
 * array means nothing comes into existence (comments, DML, security
 * labels).
 *
 * Node-level layer under {@link verifyFor}. Requires the parser WASM
 * module to be loaded (`loadModule()` from `plpgsql-parser`).
 */
export function existenceCheck(facts: StatementFacts): AnyNode[] | null {
  const warnings: string[] = [];
  const checks = emitChecks(facts, warnings);
  if (warnings.length > 0) return null;
  return checks.map(sql => {
    const parsed = parseSql(sql);
    return clone(parsed.stmts[0].stmt) as AnyNode;
  });
}
