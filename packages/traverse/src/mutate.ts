/**
 * Mutation-capable traversal for PostgreSQL ASTs.
 *
 * `traverse(root, visitor)` walks the same tree shapes as `walk` (tagged
 * nodes, concrete typed fields, bare ParseResult/ScanResult roots) but hands
 * visitors a {@link MutablePath} that supports Babel-style operations:
 *
 * - `path.replaceWith(value)` — replace this node's stored value in its
 *   container. The replacement's children are traversed; the visitor is not
 *   re-invoked on the replacement itself (no self-requeue, so a visitor that
 *   replaces a node with the same tag cannot loop).
 * - `path.remove()` — remove this node (splice from an array container or
 *   delete the field). Children are not traversed.
 * - `path.insertBefore(...values)` / `path.insertAfter(...values)` — insert
 *   siblings in an array container. Inserted values are not visited.
 * - `path.skip()` — do not traverse this node's children.
 * - `path.stop()` — end the entire traversal.
 *
 * Visitors may be plain functions (enter-only, `return false` skips children
 * like `walk`) or `{ enter?, exit? }` pairs; the tag-keyed map may also carry
 * catch-all `enter` / `exit` handlers invoked for every node.
 *
 * Traversal order is pre-order (enter), children, post-order (exit) —
 * deterministic and schema-driven, matching `walk`.
 */
import type { NodeSpec } from './18/runtime-schema';
import { runtimeSchema } from './18/runtime-schema';

const schemaMap = new Map<string, NodeSpec>(runtimeSchema.map((spec: NodeSpec) => [spec.name, spec]));

function isTaggedNode(value: any): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length === 1 && /^[A-Z]/.test(keys[0]);
}

function detectUntaggedRootTag(root: any): string | null {
  if (Array.isArray(root.stmts) && typeof root.version === 'number') {
    return 'ParseResult';
  }
  if (Array.isArray(root.tokens) && typeof root.version === 'number') {
    return 'ScanResult';
  }
  return null;
}

class TraversalState {
  stopped = false;
}

/**
 * A path handed to `traverse` visitors: the node, its tag, its parent path,
 * the root-relative key path, and — when the node lives inside a container —
 * mutation operations on that container slot.
 */
export class MutablePath<TTag extends string = string> {
  /** Number of array entries the visitor inserted before this node. */
  _insertedBefore = 0;
  /** Number of array entries the visitor inserted after this node. */
  _insertedAfter = 0;
  _removed = false;
  _skipped = false;
  _replacedWith: any = undefined;
  _didReplace = false;

  constructor(
    public tag: TTag,
    public node: any,
    public parent: MutablePath | null,
    public keyPath: readonly (string | number)[],
    /** The object or array that physically holds this node's stored value. */
    public container: any | null,
    /** The key of this node's stored value within `container`. */
    public containerKey: string | number | null,
    private state: TraversalState
  ) {}

  get path(): (string | number)[] {
    return [...this.keyPath];
  }

  get key(): string | number {
    return this.keyPath[this.keyPath.length - 1] ?? '';
  }

  get removed(): boolean {
    return this._removed;
  }

  /** Do not traverse this node's children. */
  skip(): void {
    this._skipped = true;
  }

  /** End the entire traversal. */
  stop(): void {
    this.state.stopped = true;
  }

  private assertAttached(op: string): void {
    if (this.container === null || this.containerKey === null) {
      throw new Error(`Cannot ${op} a detached path (the traversal root has no container)`);
    }
  }

  /**
   * Replace this node's stored value. Pass the value exactly as it should be
   * stored: a tagged wrapper (`{ SelectStmt: {...} }`) where the tree stores
   * tagged nodes, or bare node data for concrete typed fields.
   */
  replaceWith(value: any): void {
    this.assertAttached('replaceWith');
    if (this._removed) {
      throw new Error('Cannot replaceWith after remove');
    }
    this.container[this.containerKey as any] = value;
    this._replacedWith = value;
    this._didReplace = true;
  }

  /** Remove this node from its container. Children are not traversed. */
  remove(): void {
    this.assertAttached('remove');
    if (Array.isArray(this.container)) {
      const idx = this.containerKey as number;
      this.container.splice(idx, 1);
    } else {
      delete this.container[this.containerKey as any];
    }
    this._removed = true;
  }

  /** Insert siblings before this node (array containers only, not visited). */
  insertBefore(...values: any[]): void {
    this.assertAttached('insertBefore');
    if (!Array.isArray(this.container)) {
      throw new Error('insertBefore requires an array container');
    }
    const idx = this.containerKey as number;
    this.container.splice(idx, 0, ...values);
    this.containerKey = idx + values.length;
    this._insertedBefore += values.length;
  }

  /** Insert siblings after this node (array containers only, not visited). */
  insertAfter(...values: any[]): void {
    this.assertAttached('insertAfter');
    if (!Array.isArray(this.container)) {
      throw new Error('insertAfter requires an array container');
    }
    const idx = (this.containerKey as number) + 1 + this._insertedAfter;
    this.container.splice(idx, 0, ...values);
    this._insertedAfter += values.length;
  }
}

export type MutableWalker = (path: MutablePath) => boolean | void;

export type EnterExit = {
  enter?: MutableWalker;
  exit?: (path: MutablePath) => void;
};

export type MutableVisitor = {
  [tag: string]: MutableWalker | EnterExit;
};

function handlersFor(visitor: MutableVisitor, tag: string): { enter?: MutableWalker; exit?: (p: MutablePath) => void }[] {
  const out: { enter?: MutableWalker; exit?: (p: MutablePath) => void }[] = [];
  for (const key of [tag, 'enter', 'exit'] as const) {
    const h = visitor[key];
    if (!h) continue;
    if (key === 'enter' && typeof h === 'function') {
      out.push({ enter: h as MutableWalker });
    } else if (key === 'exit' && typeof h === 'function') {
      out.push({ exit: h as (p: MutablePath) => void });
    } else if (key === tag) {
      if (typeof h === 'function') out.push({ enter: h as MutableWalker });
      else out.push(h as EnterExit);
    }
  }
  return out;
}

/**
 * Traverse `root` with a mutation-capable visitor. See module docs for the
 * mutation semantics.
 */
export function traverse(root: any, visitor: MutableVisitor): void {
  const state = new TraversalState();
  visitValue(root, null, [], null, null, visitor, state);
}

/**
 * Visit one stored value (which may be a tagged node, a bare typed node when
 * `declaredType` names it, an array, or a plain object to descend through).
 * Returns the net change in the parent array's length caused by the visit
 * (insertions minus removal), so array iteration can stay aligned.
 */
function visitValue(
  value: any,
  parent: MutablePath | null,
  keyPath: readonly (string | number)[],
  container: any | null,
  containerKey: string | number | null,
  visitor: MutableVisitor,
  state: TraversalState,
  declaredType?: string
): number {
  if (state.stopped || typeof value !== 'object' || value === null) {
    return 0;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (state.stopped) break;
      const delta = visitValue(value[i], parent, [...keyPath, i], value, i, visitor, state);
      i += delta;
    }
    return 0;
  }

  const keys = Object.keys(value);
  if (keys.length === 1 && /^[A-Z]/.test(keys[0])) {
    return visitNode(keys[0], value[keys[0]], parent, keyPath, container, containerKey, visitor, state);
  }
  if (declaredType && declaredType !== 'Node' && schemaMap.has(declaredType) && !isTaggedNode(value)) {
    // Concrete typed field stored as a bare untagged object.
    return visitNode(declaredType, value, parent, keyPath, container, containerKey, visitor, state);
  }
  if (parent === null && keyPath.length === 0) {
    const rootTag = detectUntaggedRootTag(value);
    if (rootTag) {
      return visitNode(rootTag, value, parent, keyPath, container, containerKey, visitor, state);
    }
  }
  for (const key of keys) {
    if (state.stopped) break;
    visitValue(value[key], parent, [...keyPath, key], value, key, visitor, state);
  }
  return 0;
}

function visitNode(
  tag: string,
  nodeData: any,
  parent: MutablePath | null,
  keyPath: readonly (string | number)[],
  container: any | null,
  containerKey: string | number | null,
  visitor: MutableVisitor,
  state: TraversalState
): number {
  if (typeof nodeData !== 'object' || nodeData === null) {
    return 0;
  }

  const path = new MutablePath(tag, nodeData, parent, keyPath, container, containerKey, state);
  const handlers = handlersFor(visitor, tag);

  let skipChildren = false;
  for (const h of handlers) {
    if (!h.enter) continue;
    if (h.enter(path) === false) skipChildren = true;
    if (path._removed || state.stopped) break;
  }

  const arrayDelta = path._insertedBefore + path._insertedAfter - (path._removed ? 1 : 0);

  if (path._removed || state.stopped) {
    return Array.isArray(container) ? arrayDelta : 0;
  }

  if (path._didReplace) {
    // Traverse the replacement's children without re-invoking the visitor on
    // the replacement itself (no self-requeue).
    const replacement = path._replacedWith;
    if (isTaggedNode(replacement)) {
      const rTag = Object.keys(replacement)[0];
      traverseChildren(rTag, replacement[rTag], path, keyPath, visitor, state);
    } else if (typeof replacement === 'object' && replacement !== null) {
      traverseChildren(tag, replacement, path, keyPath, visitor, state);
    }
    return Array.isArray(container) ? arrayDelta : 0;
  }

  if (!path._skipped && !skipChildren) {
    traverseChildren(tag, nodeData, path, keyPath, visitor, state);
  }

  if (!state.stopped) {
    for (const h of handlers) {
      if (h.exit) h.exit(path);
      if (state.stopped) break;
    }
  }

  return Array.isArray(container) ? arrayDelta : 0;
}

function traverseChildren(
  tag: string,
  nodeData: any,
  path: MutablePath,
  keyPath: readonly (string | number)[],
  visitor: MutableVisitor,
  state: TraversalState
): void {
  const nodeSpec = schemaMap.get(tag);
  if (nodeSpec) {
    for (const field of nodeSpec.fields) {
      if (state.stopped) break;
      const isNodeType = field.type === 'Node' || schemaMap.has(field.type);
      if (!isNodeType || nodeData[field.name] == null) continue;
      const value = nodeData[field.name];
      if (field.isArray && Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (state.stopped) break;
          const delta = visitValue(
            value[i], path, [...keyPath, field.name, i], value, i, visitor, state, field.type
          );
          i += delta;
        }
      } else if (!field.isArray) {
        visitValue(
          value, path, [...keyPath, field.name], nodeData, field.name, visitor, state, field.type
        );
      }
    }
  } else {
    for (const key of Object.keys(nodeData)) {
      if (state.stopped) break;
      visitValue(nodeData[key], path, [...keyPath, key], nodeData, key, visitor, state);
    }
  }
}
