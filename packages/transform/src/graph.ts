/**
 * Statement-level dependency graph over classified SQL.
 *
 * {@link classifyStatements} reduces each top-level statement to
 * {@link StatementFacts} — what it creates, what it references, which of
 * those references live only inside PL/pgSQL bodies. This module turns a
 * sequence of facts into a typed dependency graph and computes the orderings
 * the granularity passes (consolidate / atomize) need:
 *
 * - **typed edges**: `hard` edges (the referenced object must exist at
 *   CREATE time), `fk` edges (foreign-key targets — hard, but singled out
 *   because they are the edges FK inlining must respect), and `late` edges
 *   (PL/pgSQL body references, resolved at call time — they never constrain
 *   deploy order and may legitimately form cycles).
 * - **SCC condensation**: strongly connected components over hard+fk edges.
 *   A well-formed DDL script condenses to singleton components; any larger
 *   component is a genuine ordering cycle (e.g. mutually referencing FKs)
 *   that granularity passes must leave in atomic form.
 * - **topological order** of the condensation, stable with respect to the
 *   original statement order (ties keep source order), so re-emission is
 *   deterministic and minimally surprising.
 */
import { QualifiedName, StatementFacts } from './facts';

/**
 * How a dependency edge constrains ordering.
 *
 * - `hard` — name must resolve when the dependent statement executes.
 * - `fk` — a hard edge arising from a foreign-key target; distinguished so
 *   folding passes can decide whether an FK may be inlined into its table.
 * - `late` — reached only inside a PL/pgSQL body; resolved at call time,
 *   so it does not constrain deploy order.
 */
export type EdgeKind = 'hard' | 'fk' | 'late';

/** A directed dependency: statement `from` depends on statement `to`. */
export interface StatementEdge {
  from: number;
  to: number;
  kind: EdgeKind;
  /** The referenced object that induced this edge. */
  via: QualifiedName;
}

/** A node in the statement graph: one top-level statement. */
export interface StatementNode {
  /** Index of the statement in the classified script. */
  index: number;
  facts: StatementFacts;
  /** Outgoing edges (this statement's dependencies). */
  out: StatementEdge[];
  /** Incoming edges (statements that depend on this one). */
  in: StatementEdge[];
}

/** The statement-level dependency graph for one SQL script. */
export interface StatementGraph {
  nodes: StatementNode[];
  edges: StatementEdge[];
  /**
   * `schema.name` → indices of the statements that create that object.
   * Trigger and policy names are table-qualified (`table.trigger`), matching
   * {@link StatementFacts.creates}.
   */
  producers: Map<string, number[]>;
  /**
   * Strongly connected components over `hard` + `fk` edges, in topological
   * order of the condensation. Singleton components are the common case;
   * larger ones are genuine DDL ordering cycles.
   */
  components: number[][];
  /**
   * A stable topological order of all statements: components in condensation
   * order, members of a component in source order. Ties between independent
   * components keep source order.
   */
  order: number[];
}

const keyOf = (q: QualifiedName): string => `${q.schema ?? ''}.${q.name}`;

/**
 * Build the typed statement dependency graph for a classified script.
 *
 * Edges only exist between statements of the same script: a reference with
 * no in-script producer is an external dependency and induces no edge (the
 * caller decides what to do with those — pgpm expresses them as
 * cross-package requires).
 */
export function buildStatementGraph(facts: StatementFacts[]): StatementGraph {
  const nodes: StatementNode[] = facts.map((f, index) => ({
    index,
    facts: f,
    out: [] as StatementEdge[],
    in: [] as StatementEdge[]
  }));

  const producers = new Map<string, number[]>();
  facts.forEach((f, i) => {
    for (const created of f.creates) {
      const key = keyOf(created);
      const list = producers.get(key) ?? [];
      list.push(i);
      producers.set(key, list);
    }
  });

  // The producer a reference binds to is the closest preceding statement
  // that creates the object (redefinitions shadow earlier ones); when the
  // reference precedes every producer, it binds to the first one — that is
  // exactly the forward edge a reordering pass must satisfy.
  const bind = (ref: QualifiedName, from: number): number | undefined => {
    const list = producers.get(keyOf(ref));
    if (!list || list.length === 0) return undefined;
    let found: number | undefined;
    for (const i of list) {
      if (i === from) return undefined; // self-dependency: never an edge
      if (i < from) found = i;
    }
    return found ?? list[0];
  };

  const edges: StatementEdge[] = [];
  const addEdge = (from: number, to: number, kind: EdgeKind, via: QualifiedName) => {
    if (edges.some(e => e.from === from && e.to === to && e.kind === kind)) return;
    const edge: StatementEdge = { from, to, kind, via };
    edges.push(edge);
    nodes[from].out.push(edge);
    nodes[to].in.push(edge);
  };

  facts.forEach((f, i) => {
    const bodyOnly = new Set(f.bodyReferences.map(keyOf));
    const fkKeys = new Set(f.fkTargets.map(keyOf));
    for (const ref of f.references) {
      const to = bind(ref, i);
      if (to === undefined) continue;
      const key = keyOf(ref);
      const kind: EdgeKind = fkKeys.has(key) ? 'fk' : bodyOnly.has(key) ? 'late' : 'hard';
      addEdge(i, to, kind, ref);
    }
  });

  const components = condense(nodes);
  const order = stableTopoOrder(nodes, components);
  return { nodes, edges, producers, components, order };
}

/**
 * Tarjan SCC over `hard` + `fk` edges (`late` edges are ignored — they are
 * call-time bindings and legitimately cyclic). Components are returned in
 * reverse-topological completion order and then re-sorted topologically with
 * source-order tie-breaking by {@link stableTopoOrder}; here we only sort
 * each component's members and order components by their smallest member so
 * output is deterministic.
 */
function condense(nodes: StatementNode[]): number[][] {
  const n = nodes.length;
  const indexOf = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const onStack = new Array<boolean>(n).fill(false);
  const stack: number[] = [];
  const components: number[][] = [];
  let counter = 0;

  const orderingEdges = (v: number): number[] =>
    nodes[v].out.filter(e => e.kind !== 'late').map(e => e.to);

  // Iterative Tarjan (DDL scripts can be tens of thousands of statements).
  const visit = (root: number): void => {
    interface Frame { v: number; edges: number[]; i: number }
    const frames: Frame[] = [{ v: root, edges: orderingEdges(root), i: 0 }];
    indexOf[root] = low[root] = counter++;
    stack.push(root);
    onStack[root] = true;

    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      if (frame.i < frame.edges.length) {
        const w = frame.edges[frame.i++];
        if (indexOf[w] === -1) {
          indexOf[w] = low[w] = counter++;
          stack.push(w);
          onStack[w] = true;
          frames.push({ v: w, edges: orderingEdges(w), i: 0 });
        } else if (onStack[w]) {
          low[frame.v] = Math.min(low[frame.v], indexOf[w]);
        }
      } else {
        frames.pop();
        if (frames.length > 0) {
          const parent = frames[frames.length - 1];
          low[parent.v] = Math.min(low[parent.v], low[frame.v]);
        }
        if (low[frame.v] === indexOf[frame.v]) {
          const component: number[] = [];
          for (;;) {
            const w = stack.pop()!;
            onStack[w] = false;
            component.push(w);
            if (w === frame.v) break;
          }
          component.sort((a, b) => a - b);
          components.push(component);
        }
      }
    }
  };

  for (let v = 0; v < n; v++) {
    if (indexOf[v] === -1) visit(v);
  }
  components.sort((a, b) => a[0] - b[0]);
  return components;
}

/**
 * Topologically order the condensation with source order breaking ties
 * (Kahn's algorithm over components, min-heap on smallest member index),
 * then flatten: members of each component stay in source order.
 */
function stableTopoOrder(nodes: StatementNode[], components: number[][]): number[] {
  const componentOf = new Array<number>(nodes.length).fill(0);
  components.forEach((members, c) => {
    for (const m of members) componentOf[m] = c;
  });

  const succ: Set<number>[] = components.map(() => new Set());
  const indegree = new Array<number>(components.length).fill(0);
  for (const node of nodes) {
    for (const e of node.out) {
      if (e.kind === 'late') continue;
      const from = componentOf[e.from];
      const to = componentOf[e.to];
      if (from === to) continue;
      // Dependency edge from → to means `to` must come first.
      if (!succ[to].has(from)) {
        succ[to].add(from);
        indegree[from]++;
      }
    }
  }

  const ready: number[] = [];
  for (let c = 0; c < components.length; c++) {
    if (indegree[c] === 0) ready.push(c);
  }
  const takeMin = (): number => {
    let best = 0;
    for (let i = 1; i < ready.length; i++) {
      if (components[ready[i]][0] < components[ready[best]][0]) best = i;
    }
    return ready.splice(best, 1)[0];
  };

  const order: number[] = [];
  while (ready.length > 0) {
    const c = takeMin();
    order.push(...components[c]);
    for (const next of succ[c]) {
      if (--indegree[next] === 0) ready.push(next);
    }
  }
  return order;
}
