import { walk as walkSql } from '@pgsql/traverse';
import { parseSql, transformSync, walk as walkPlpgsql } from 'plpgsql-parser';

/**
 * A (possibly schema-qualified) object name extracted from a statement.
 */
export interface QualifiedName {
  schema: string | null;
  name: string;
}

/**
 * Coarse statement classification used for tier/package sorting.
 */
export type StatementKind =
  | 'schema'
  | 'table'
  | 'view'
  | 'index'
  | 'type'
  | 'function'
  | 'trigger'
  | 'policy'
  | 'grant'
  | 'rls_enable'
  | 'fk_constraint'
  | 'constraint'
  | 'comment'
  | 'seed_dml'
  | 'other';

/**
 * AST-derived facts about a single top-level SQL statement.
 *
 * Read-only: classification never modifies the statement. Facts are the
 * substrate for classifier-driven slicing (schema / functionality / security
 * tiers) — replacing path/name-glob decisions with computed properties like
 * "this trigger function references billing".
 */
export interface StatementFacts {
  /** Coarse category of the statement. */
  kind: StatementKind;
  /** The raw parser node tag (e.g. `CreateStmt`, `CreatePolicyStmt`). */
  nodeTag: string;
  /** Objects this statement creates or directly targets. */
  creates: QualifiedName[];
  /**
   * Schema-qualified objects this statement references — tables, functions
   * and types reached anywhere in the statement, including PL/pgSQL bodies.
   * Unqualified references are omitted (they resolve via search_path and
   * carry no cross-schema information).
   */
  references: QualifiedName[];
  /**
   * The subset of `references` reached only inside a PL/pgSQL body. These
   * are late-binding: Postgres resolves them at call time, not at CREATE
   * time, so they do not constrain deploy order (and legitimately form
   * recursion cycles between functions).
   */
  bodyReferences: QualifiedName[];
  /** Distinct schemas reached by `references`. */
  referencedSchemas: string[];
  /** Role names granted to, owning, or bound by this statement. */
  roles: string[];
  /** Foreign-key target tables (from column/table FK constraints). */
  fkTargets: QualifiedName[];
  /**
   * Whether the statement is part of the security surface: policies, grants,
   * RLS enable/force, security labels, ownership.
   */
  securityRelevant: boolean;
  /** For functions: declared with SECURITY DEFINER. */
  securityDefiner: boolean;
  /**
   * For functions: the body executes dynamic SQL (EXECUTE / EXECUTE ... USING
   * / FOR ... IN EXECUTE). Analogous to `eval` — references inside the
   * dynamic string are invisible to the AST, so edges from this statement
   * are incomplete and slicing should treat it conservatively.
   */
  dynamicSql: boolean;
}

const SECURITY_TAGS = new Set([
  'CreatePolicyStmt',
  'AlterPolicyStmt',
  'GrantStmt',
  'GrantRoleStmt',
  'AlterDefaultPrivilegesStmt',
  'SecLabelStmt',
  'AlterOwnerStmt',
  'CreateRoleStmt',
  'AlterRoleStmt'
]);

const KIND_BY_TAG: Record<string, StatementKind> = {
  CreateSchemaStmt: 'schema',
  CreateStmt: 'table',
  ViewStmt: 'view',
  IndexStmt: 'index',
  CompositeTypeStmt: 'type',
  CreateEnumStmt: 'type',
  CreateDomainStmt: 'type',
  CreateRangeStmt: 'type',
  DefineStmt: 'type',
  CreateFunctionStmt: 'function',
  CreateTrigStmt: 'trigger',
  CreateEventTrigStmt: 'trigger',
  CreatePolicyStmt: 'policy',
  AlterPolicyStmt: 'policy',
  GrantStmt: 'grant',
  GrantRoleStmt: 'grant',
  AlterDefaultPrivilegesStmt: 'grant',
  CommentStmt: 'comment',
  InsertStmt: 'seed_dml',
  UpdateStmt: 'seed_dml',
  DeleteStmt: 'seed_dml'
};

function qn(schema: string | null | undefined, name: string): QualifiedName {
  return { schema: schema ?? null, name };
}

function nameListToQualified(names: any[] | undefined): QualifiedName | null {
  if (!Array.isArray(names) || names.length === 0) return null;
  const parts = names
    .map((n: any) => n?.String?.sval)
    .filter((s: any) => typeof s === 'string');
  if (parts.length === 0) return null;
  if (parts.length === 1) return qn(null, parts[0]);
  return qn(parts[parts.length - 2], parts[parts.length - 1]);
}

function isCatalogSchema(schema: string | null): boolean {
  return schema === 'pg_catalog' || schema === 'information_schema';
}

function pushRef(refs: QualifiedName[], ref: QualifiedName | null): void {
  if (!ref || !ref.schema || isCatalogSchema(ref.schema)) return;
  if (refs.some(r => r.schema === ref.schema && r.name === ref.name)) return;
  refs.push(ref);
}

function collectRoles(node: any, roles: string[]): void {
  const push = (role: string | undefined) => {
    if (typeof role === 'string' && role.length > 0 && !roles.includes(role)) {
      roles.push(role);
    }
  };
  if (Array.isArray(node?.grantees)) {
    for (const g of node.grantees) push(g?.RoleSpec?.rolename);
  }
  if (Array.isArray(node?.roles)) {
    for (const r of node.roles) push(r?.RoleSpec?.rolename);
  }
  push(node?.newowner?.rolename);
  push(node?.role?.rolename);
}

/**
 * Create a read-only visitor that accumulates references, roles and FK
 * targets into the provided facts object.
 */
function createFactsVisitor(facts: StatementFacts, bodyRefs?: QualifiedName[]) {
  const push = (ref: QualifiedName | null) => {
    pushRef(facts.references, ref);
    if (bodyRefs) pushRef(bodyRefs, ref);
  };
  return {
    RangeVar: (path: any) => {
      const node = path.node;
      if (node.schemaname) {
        push(qn(node.schemaname, node.relname));
      }
    },
    FuncCall: (path: any) => {
      push(nameListToQualified(path.node.funcname));
    },
    TypeName: (path: any) => {
      push(nameListToQualified(path.node.names));
    },
    ColumnRef: (path: any) => {
      // schema.table.column references carry cross-schema information
      const fields = path.node.fields;
      if (Array.isArray(fields) && fields.length >= 3) {
        const parts = fields
          .map((f: any) => f?.String?.sval)
          .filter((s: any) => typeof s === 'string');
        if (parts.length >= 3) {
          push(qn(parts[0], parts[1]));
        }
      }
    },
    Constraint: (path: any) => {
      const node = path.node;
      if (node.contype === 'CONSTR_FOREIGN' && node.pktable) {
        const target = qn(node.pktable.schemaname ?? null, node.pktable.relname);
        if (!facts.fkTargets.some(t => t.schema === target.schema && t.name === target.name)) {
          facts.fkTargets.push(target);
        }
        if (target.schema) pushRef(facts.references, target);
      }
    }
  };
}

function classifyOne(nodeTag: string, node: any): StatementFacts {
  const facts: StatementFacts = {
    kind: KIND_BY_TAG[nodeTag] ?? 'other',
    nodeTag,
    creates: [],
    references: [],
    referencedSchemas: [],
    roles: [],
    fkTargets: [],
    bodyReferences: [],
    securityRelevant: SECURITY_TAGS.has(nodeTag),
    securityDefiner: false,
    dynamicSql: false
  };

  switch (nodeTag) {
    case 'CreateSchemaStmt':
      facts.creates.push(qn(null, node.schemaname));
      break;
    case 'CreateStmt':
    case 'ViewStmt': {
      const rel = nodeTag === 'ViewStmt' ? node.view : node.relation;
      if (rel) facts.creates.push(qn(rel.schemaname ?? null, rel.relname));
      break;
    }
    case 'IndexStmt':
      if (node.relation) {
        facts.creates.push(qn(node.relation.schemaname ?? null, node.idxname ?? node.relation.relname));
      }
      break;
    case 'CreateFunctionStmt': {
      const name = nameListToQualified(node.funcname);
      if (name) facts.creates.push(name);
      for (const opt of node.options ?? []) {
        const def = opt?.DefElem;
        if (def?.defname === 'security' && def?.arg?.Boolean?.boolval === true) {
          facts.securityDefiner = true;
        }
      }
      break;
    }
    case 'CreateTrigStmt':
      if (node.relation) {
        // Trigger names are only unique per table; qualify with the table.
        facts.creates.push(
          qn(node.relation.schemaname ?? null, `${node.relation.relname}.${node.trigname}`)
        );
      }
      pushRef(facts.references, nameListToQualified(node.funcname));
      break;
    case 'CreatePolicyStmt':
    case 'AlterPolicyStmt':
      if (node.table) {
        // Policy names are only unique per table; qualify with the table.
        facts.creates.push(
          qn(node.table.schemaname ?? null, `${node.table.relname}.${node.policy_name}`)
        );
        // The guarded table lives on `node.table`; the generic RangeVar walker
        // does not descend into it, so capture the reference explicitly.
        if (node.table.schemaname) {
          pushRef(facts.references, qn(node.table.schemaname, node.table.relname));
        }
      }
      break;
    case 'CreateSeqStmt':
      if (node.sequence) {
        facts.creates.push(qn(node.sequence.schemaname ?? null, node.sequence.relname));
      }
      break;
    case 'CompositeTypeStmt':
      if (node.typevar) {
        facts.creates.push(qn(node.typevar.schemaname ?? null, node.typevar.relname));
      }
      break;
    case 'CreateEnumStmt':
    case 'CreateDomainStmt':
    case 'CreateRangeStmt': {
      const name = nameListToQualified(node.typeName ?? node.domainname);
      if (name) facts.creates.push(name);
      break;
    }
    case 'AlterTableStmt': {
      if (node.relation) {
        facts.creates.push(qn(node.relation.schemaname ?? null, node.relation.relname));
      }
      const cmds: any[] = node.cmds ?? [];
      for (const cmd of cmds) {
        const subtype = cmd?.AlterTableCmd?.subtype;
        if (subtype === 'AT_EnableRowSecurity' || subtype === 'AT_ForceRowSecurity' ||
            subtype === 'AT_DisableRowSecurity' || subtype === 'AT_NoForceRowSecurity') {
          facts.kind = 'rls_enable';
          facts.securityRelevant = true;
        } else if (subtype === 'AT_AddConstraint') {
          const contype = cmd?.AlterTableCmd?.def?.Constraint?.contype;
          facts.kind = contype === 'CONSTR_FOREIGN' ? 'fk_constraint' : 'constraint';
        } else if (subtype === 'AT_ChangeOwner') {
          facts.securityRelevant = true;
          const owner = cmd?.AlterTableCmd?.newowner?.rolename;
          if (owner && !facts.roles.includes(owner)) facts.roles.push(owner);
        }
      }
      break;
    }
    case 'InsertStmt':
    case 'UpdateStmt':
    case 'DeleteStmt':
      if (node.relation) {
        facts.creates.push(qn(node.relation.schemaname ?? null, node.relation.relname));
      }
      break;
    default:
      break;
  }

  collectRoles(node, facts.roles);
  return facts;
}

/** Read a `CreateFunctionStmt` DefElem option's scalar/list value. */
function functionOption(node: any, defname: string): any {
  for (const opt of node.options ?? []) {
    if (opt?.DefElem?.defname === defname) return opt.DefElem.arg;
  }
  return undefined;
}

/**
 * Collect references from a `LANGUAGE sql` function body supplied as a string
 * literal (`AS $$ ... $$`). That body is an opaque String node the AST walker
 * never parses, so — mirroring the schema transformer's body rewrite — parse
 * it standalone and walk each statement with the facts visitor. The standard
 * `BEGIN ATOMIC` / `RETURN` `sql_body` form is already part of the AST and is
 * covered by the outer walk, so only the string form needs this.
 */
function collectSqlBodyReferences(node: any, facts: StatementFacts): void {
  const language = functionOption(node, 'language')?.String?.sval;
  if (typeof language !== 'string' || language.toLowerCase() !== 'sql') return;

  const asArg = functionOption(node, 'as');
  const items: any[] = asArg?.List?.items ?? [];
  const body = items[0]?.String?.sval;
  if (typeof body !== 'string') return;

  try {
    const stmts: any[] = parseSql(body)?.stmts ?? [];
    const visitor = createFactsVisitor(facts, facts.bodyReferences);
    for (const stmt of stmts) {
      if (stmt?.stmt) walkSql(stmt.stmt, visitor);
    }
  } catch {
    // A non-parseable body (C symbol name, etc.) contributes no references.
  }
}

/**
 * Classify each top-level statement in a SQL script into {@link StatementFacts}.
 *
 * Uses the same parser stack as the schema transformer (pgsql AST walk plus
 * hydrated PL/pgSQL body walk), so references inside function bodies are
 * included. The input SQL is never modified.
 */
export function classifyStatements(sql: string): StatementFacts[] {
  const allFacts: StatementFacts[] = [];

  transformSync(sql, (ctx) => {
    const stmts: any[] = ctx.sql?.stmts ?? [];
    for (const stmt of stmts) {
      const stmtNode = stmt?.stmt;
      const nodeTag = stmtNode ? Object.keys(stmtNode)[0] : 'other';
      const node = stmtNode?.[nodeTag] ?? {};
      const facts = classifyOne(nodeTag, node);

      if (stmtNode) {
        walkSql(stmtNode, createFactsVisitor(facts));
      }
      if (nodeTag === 'CreateFunctionStmt') {
        collectSqlBodyReferences(node, facts);
      }
      allFacts.push(facts);
    }

    for (const fn of ctx.functions ?? []) {
      const facts = allFacts[fn.stmtIndex];
      if (!facts || !fn.plpgsql?.hydrated) continue;
      // Refs already found outside the body (signature types, defaults)
      // constrain deploy order and are not body-only.
      const outer = new Set(
        facts.references.map(r => `${r.schema ?? '?'}.${r.name}`)
      );
      walkPlpgsql(fn.plpgsql.hydrated, {
        PLpgSQL_stmt_dynexecute: () => { facts.dynamicSql = true; },
        PLpgSQL_stmt_dynfors: () => { facts.dynamicSql = true; }
      }, {
        walkSqlExpressions: true,
        sqlVisitor: createFactsVisitor(facts, facts.bodyReferences)
      });
      facts.bodyReferences = facts.bodyReferences.filter(
        r => !outer.has(`${r.schema ?? '?'}.${r.name}`)
      );
    }
  }, { hydrate: true });

  for (const facts of allFacts) {
    const selfRef = (r: QualifiedName) =>
      facts.creates.some(c => c.schema === r.schema && c.name === r.name);
    facts.references = facts.references.filter(r => !selfRef(r));
    facts.bodyReferences = facts.bodyReferences.filter(r => !selfRef(r));
    facts.referencedSchemas = [...new Set(facts.references.map(r => r.schema).filter(Boolean))] as string[];
  }

  return allFacts;
}
