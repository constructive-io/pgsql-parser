/**
 * Granularity restructuring: rewrite a DDL script between equivalent shapes
 * without changing the schema it produces.
 *
 * Three levels, two directions:
 *
 * - `atomic` — every table is a bare `CREATE TABLE ()` followed by one
 *   `ALTER TABLE ADD COLUMN` per column and one `ADD CONSTRAINT` per
 *   constraint (the shape machine emitters produce).
 * - `object` — each table is fully baked: columns and same-table constraints
 *   (PK / UNIQUE / CHECK / NOT NULL / DEFAULT) fold into the `CREATE TABLE`;
 *   cross-object statements (FKs, indexes, triggers, policies) stay separate.
 * - `consolidated` — additionally inlines foreign keys into the table
 *   definition whenever the dependency graph proves it safe (the referenced
 *   table can be ordered first); FKs on cycles stay as `ALTER TABLE`.
 *
 * Every fold is validated against the {@link buildStatementGraph} statement
 * graph: a candidate merge is rejected if it would create an ordering cycle,
 * so the pass degrades gracefully to the atomic form instead of emitting an
 * undeployable script. Output statements are re-emitted in the graph's
 * stable topological order.
 */
import { Deparser, parseSql } from 'plpgsql-parser';

import { classifyStatements } from './facts';
import { buildStatementGraph, StatementGraph } from './graph';

/** The target shape of a restructured script. */
export type Granularity = 'atomic' | 'object' | 'consolidated';

export interface RestructureOptions {
  granularity: Granularity;
}

export interface RestructureResult {
  /** The restructured script, statements in stable topological order. */
  sql: string;
  /** Number of statements folded into a `CREATE TABLE` (fold direction). */
  folded: number;
  /** Number of statements produced by explosion (atomize direction). */
  exploded: number;
  /** Folds that were rejected (with the reason) and other non-fatal notes. */
  warnings: string[];
}

type AnyNode = Record<string, any>;

const relKey = (rel: AnyNode | undefined): string | null =>
  rel ? `${rel.schemaname ?? ''}.${rel.relname}` : null;

const sameRel = (a: AnyNode | undefined, b: AnyNode | undefined): boolean =>
  !!a && !!b && relKey(a) === relKey(b);

/**
 * Restructure a DDL script to the requested granularity. The input and
 * output scripts deploy to identical schemas; only statement shape and
 * order change.
 */
export function restructureSql(sql: string, options: RestructureOptions): RestructureResult {
  const warnings: string[] = [];
  const parsed = parseSql(sql);
  const stmts: AnyNode[] = (parsed?.stmts ?? [])
    .map((s: AnyNode) => s?.stmt)
    .filter(Boolean);

  let outStmts: AnyNode[];
  let folded = 0;
  let exploded = 0;

  if (options.granularity === 'atomic') {
    const result = explodeStatements(stmts);
    outStmts = result.stmts;
    exploded = result.exploded;
  } else {
    const facts = classifyStatements(sql);
    const graph = buildStatementGraph(facts);
    const result = foldStatements(stmts, graph, options.granularity === 'consolidated', warnings);
    outStmts = result.stmts;
    folded = result.folded;
  }

  const ordered = orderStatements(outStmts);
  const text = ordered.map(s => `${Deparser.deparse(s)};`).join('\n\n');
  return { sql: text, folded, exploded, warnings };
}

/**
 * Re-emit statements in the stable topological order of their dependency
 * graph. Statements are deparsed and re-classified so the ordering reflects
 * exactly what will be emitted.
 */
export function orderStatements(stmts: AnyNode[]): AnyNode[] {
  if (stmts.length <= 1) return stmts;
  const script = stmts.map(s => `${Deparser.deparse(s)};`).join('\n');
  const graph = buildStatementGraph(classifyStatements(script));
  if (graph.order.length !== stmts.length) return stmts;
  return graph.order.map(i => stmts[i]);
}

interface FoldResult {
  stmts: AnyNode[];
  folded: number;
}

/**
 * Fold `ALTER TABLE` commands into their table's `CREATE TABLE` statement.
 * `inlineFks` additionally folds `ADD FOREIGN KEY` when the graph proves the
 * referenced table can be created first.
 */
function foldStatements(
  stmts: AnyNode[],
  graph: StatementGraph,
  inlineFks: boolean,
  warnings: string[]
): FoldResult {
  // Locate the CREATE TABLE for each relation.
  const createIndex = new Map<string, number>();
  stmts.forEach((s, i) => {
    const create = s?.CreateStmt;
    if (create?.relation) {
      const key = relKey(create.relation);
      if (key && !createIndex.has(key)) createIndex.set(key, i);
    }
  });

  // Fold bookkeeping is a union-find over statements: folding j into the
  // CREATE at i merges their graph nodes, and the merged node's dependency
  // set is the union of both. Reachability is then computed over merged
  // nodes so a second fold cannot silently complete a cycle the first one
  // started (the mutual-FK case).
  const rep = new Map<number, number>();
  const find = (v: number): number => {
    let r = v;
    while (rep.has(r)) r = rep.get(r)!;
    return r;
  };

  // Per-statement dependencies: typed graph edges plus the implicit edge
  // from every ALTER to its own table's CREATE (the facts model records the
  // alter as *targeting* the table, so the graph carries no self edge).
  const deps = new Map<number, Set<number>>();
  stmts.forEach((s, j) => {
    const set = new Set<number>();
    for (const e of graph.nodes[j]?.out ?? []) {
      if (e.kind !== 'late') set.add(e.to);
    }
    const alterKey = relKey(s?.AlterTableStmt?.relation);
    const own = alterKey ? createIndex.get(alterKey) : undefined;
    if (own !== undefined && own !== j) set.add(own);
    deps.set(j, set);
  });

  const depsOf = (v: number): number[] =>
    [...(deps.get(find(v)) ?? [])].map(find).filter(t => t !== find(v));

  const dependsOn = (from: number, target: number): boolean => {
    const goal = find(target);
    const seen = new Set<number>();
    const stack = [find(from)];
    while (stack.length > 0) {
      const v = stack.pop()!;
      if (v === goal) return true;
      if (seen.has(v)) continue;
      seen.add(v);
      stack.push(...depsOf(v));
    }
    return false;
  };

  /**
   * A command at statement `j` may fold into the CREATE at statement `i`
   * iff none of j's dependencies (other than i itself) transitively depend
   * on i — otherwise the merged node would sit on a cycle.
   */
  const safeToFold = (j: number, i: number): boolean =>
    !depsOf(j).some(t => t !== find(i) && dependsOn(t, i));

  /** Merge statement `j` into the CREATE at `i`. */
  const absorb = (i: number, j: number): void => {
    const target = find(i);
    const merged = deps.get(target) ?? new Set<number>();
    for (const t of deps.get(find(j)) ?? []) merged.add(t);
    deps.set(target, merged);
    if (find(j) !== target) rep.set(find(j), target);
  };

  const remove = new Set<number>();
  let folded = 0;

  stmts.forEach((s, j) => {
    const alter = s?.AlterTableStmt;
    if (!alter || alter.objtype !== 'OBJECT_TABLE') return;
    const key = relKey(alter.relation);
    const i = key ? createIndex.get(key) : undefined;
    if (i === undefined || i === j) return;

    const create = stmts[i].CreateStmt;
    const remaining: AnyNode[] = [];

    for (const wrapped of alter.cmds ?? []) {
      const cmd = wrapped?.AlterTableCmd;
      if (!cmd) {
        remaining.push(wrapped);
        continue;
      }
      const constraint = cmd.def?.Constraint;
      const isFk = cmd.subtype === 'AT_AddConstraint' && constraint?.contype === 'CONSTR_FOREIGN';
      const selfFk = isFk && sameRel(constraint?.pktable, alter.relation);

      let foldable = false;
      switch (cmd.subtype) {
        case 'AT_AddColumn':
          foldable = !!cmd.def?.ColumnDef;
          break;
        case 'AT_ColumnDefault':
          foldable = !!cmd.name && cmd.def !== undefined;
          break;
        case 'AT_SetNotNull':
          foldable = !!cmd.name;
          break;
        case 'AT_AddConstraint':
          foldable = isFk ? selfFk || inlineFks : true;
          break;
        default:
          foldable = false;
      }

      if (foldable && !selfFk && !safeToFold(j, i)) {
        warnings.push(
          `kept atomic: statement ${j} on ${key} would create an ordering cycle if folded`
        );
        foldable = false;
      }

      if (!foldable) {
        remaining.push(wrapped);
        continue;
      }

      if (!applyFold(create, cmd)) {
        remaining.push(wrapped);
        continue;
      }
      absorb(i, j);
      folded++;
    }

    if (remaining.length === 0) {
      remove.add(j);
    } else {
      alter.cmds = remaining;
    }
  });

  return { stmts: stmts.filter((_, i) => !remove.has(i)), folded };
}

/** Apply one foldable ALTER TABLE command onto a CreateStmt. */
function applyFold(create: AnyNode, cmd: AnyNode): boolean {
  create.tableElts = create.tableElts ?? [];

  const findColumn = (name: string): AnyNode | undefined =>
    create.tableElts.find((e: AnyNode) => e?.ColumnDef?.colname === name)?.ColumnDef;

  switch (cmd.subtype) {
    case 'AT_AddColumn':
      create.tableElts.push({ ColumnDef: cmd.def.ColumnDef });
      return true;
    case 'AT_ColumnDefault': {
      const col = findColumn(cmd.name);
      if (!col) return false;
      col.constraints = col.constraints ?? [];
      col.constraints.push({ Constraint: { contype: 'CONSTR_DEFAULT', raw_expr: cmd.def } });
      return true;
    }
    case 'AT_SetNotNull': {
      const col = findColumn(cmd.name);
      if (!col) return false;
      col.constraints = col.constraints ?? [];
      col.constraints.push({ Constraint: { contype: 'CONSTR_NOTNULL' } });
      return true;
    }
    case 'AT_AddConstraint':
      create.tableElts.push({ Constraint: cmd.def.Constraint });
      return true;
    default:
      return false;
  }
}

interface ExplodeResult {
  stmts: AnyNode[];
  exploded: number;
}

/** Column-level constraint types that stay inline on `ADD COLUMN`. */
const INLINE_COLUMN_CONSTRAINTS = new Set(['CONSTR_DEFAULT', 'CONSTR_NOTNULL', 'CONSTR_NULL', 'CONSTR_IDENTITY', 'CONSTR_GENERATED']);

/**
 * Explode consolidated `CREATE TABLE` statements into the atomic shape:
 * bare create, one `ADD COLUMN` per column (keeping column-local defaults /
 * NOT NULL inline), one `ADD CONSTRAINT` per table-level or key constraint.
 */
function explodeStatements(stmts: AnyNode[]): ExplodeResult {
  const out: AnyNode[] = [];
  let exploded = 0;

  const alterFor = (relation: AnyNode, cmd: AnyNode): AnyNode => ({
    AlterTableStmt: {
      objtype: 'OBJECT_TABLE',
      relation,
      cmds: [{ AlterTableCmd: cmd }]
    }
  });

  for (const s of stmts) {
    const create = s?.CreateStmt;
    const elts: AnyNode[] = create?.tableElts ?? [];
    // Typed tables / partitions / inheritance keep their shape.
    if (!create || elts.length === 0 || create.ofTypename || create.partbound || create.inhRelations) {
      out.push(s);
      continue;
    }

    const relation = create.relation;
    const columns: AnyNode[] = [];
    const constraints: AnyNode[] = [];

    for (const elt of elts) {
      if (elt?.ColumnDef) columns.push(elt.ColumnDef);
      else if (elt?.Constraint) constraints.push(elt.Constraint);
      else {
        // Unknown element (e.g. LIKE clause): keep the table intact.
        columns.length = 0;
        constraints.length = 0;
        break;
      }
    }
    if (columns.length === 0 && constraints.length === 0) {
      out.push(s);
      continue;
    }

    out.push({ CreateStmt: { ...create, tableElts: [] } });

    for (const col of columns) {
      const inline: AnyNode[] = [];
      for (const wrapped of col.constraints ?? []) {
        const c = wrapped?.Constraint;
        if (c && INLINE_COLUMN_CONSTRAINTS.has(c.contype)) {
          inline.push(wrapped);
        } else if (c) {
          // Promote a column constraint (PK/UNIQUE/CHECK/FK) to table level.
          constraints.push(columnConstraintToTable(c, col.colname));
        }
      }
      out.push(alterFor(relation, {
        subtype: 'AT_AddColumn',
        def: { ColumnDef: { ...col, constraints: inline.length > 0 ? inline : undefined } }
      }));
      exploded++;
    }

    for (const constraint of constraints) {
      out.push(alterFor(relation, {
        subtype: 'AT_AddConstraint',
        def: { Constraint: constraint }
      }));
      exploded++;
    }
  }

  return { stmts: out, exploded };
}

/** Rewrite a column-level constraint as its table-level equivalent. */
function columnConstraintToTable(constraint: AnyNode, colname: string): AnyNode {
  const strNode = (sval: string): AnyNode => ({ String: { sval } });
  switch (constraint.contype) {
    case 'CONSTR_PRIMARY':
    case 'CONSTR_UNIQUE':
      return { ...constraint, keys: [strNode(colname)] };
    case 'CONSTR_FOREIGN':
      return { ...constraint, fk_attrs: [strNode(colname)] };
    default:
      // CHECK and others are valid table constraints as-is.
      return constraint;
  }
}
