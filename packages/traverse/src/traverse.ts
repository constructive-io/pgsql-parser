
import type { Node } from '@pgsql/types';

import type { NodeSpec } from './18/runtime-schema';
import { runtimeSchema } from './18/runtime-schema';

const schemaMap = new Map<string, NodeSpec>(runtimeSchema.map((spec: NodeSpec) => [spec.name, spec]));

export type NodeTag = keyof Node;

export class NodePath<TTag extends string = string> {
  constructor(
    public tag: TTag,
    public node: any,
    public parent: NodePath | null = null,
    public keyPath: readonly (string | number)[] = []
  ) {}

  get path(): (string | number)[] {
    return [...this.keyPath];
  }

  get key(): string | number {
    return this.keyPath[this.keyPath.length - 1] ?? '';
  }
}

export type Walker<TNodePath extends NodePath = NodePath> = (
  path: TNodePath,
) => boolean | void;

export type Visitor = {
  [key: string]: Walker<NodePath>;
};

/**
 * Walks the tree of PostgreSQL AST nodes using runtime schema for precise traversal.
 * 
 * If a callback returns `false`, the walk will continue to the next sibling
 * node, rather than recurse into the children of the current node.
 */
export function walk(
  root: any,
  callback: Walker | Visitor,
  parent: NodePath | null = null,
  keyPath: readonly (string | number)[] = [],
): void {
  const actualCallback: Walker = typeof callback === 'function' 
    ? callback 
    : (path: NodePath) => {
      const visitor = callback as Visitor;
      const visitFn = visitor[path.tag];
      return visitFn ? visitFn(path) : undefined;
    };

  if (Array.isArray(root)) {
    root.forEach((node, index) => {
      walk(node, actualCallback, parent, [...keyPath, index]);
    });
  } else if (typeof root === 'object' && root !== null) {
    const keys = Object.keys(root);
    if (keys.length === 1 && /^[A-Z]/.test(keys[0])) {
      walkNode(keys[0], root[keys[0]], actualCallback, parent, keyPath);
      return;
    }
    if (parent === null && keyPath.length === 0) {
      const rootTag = detectUntaggedRootTag(root);
      if (rootTag) {
        walkNode(rootTag, root, actualCallback, parent, keyPath);
        return;
      }
    }
    for (const key of keys) {
      walk(root[key], actualCallback, parent, [...keyPath, key]);
    }
  }
}

/**
 * libpg-query returns the top-level ParseResult/ScanResult as a bare object
 * (no `{ParseResult: {...}}` wrapper). Detect those shapes at the root so
 * their visitors — and typed descendants like RawStmt — are dispatched.
 */
function detectUntaggedRootTag(root: any): string | null {
  if (Array.isArray(root.stmts) && typeof root.version === 'number') {
    return 'ParseResult';
  }
  if (Array.isArray(root.tokens) && typeof root.version === 'number') {
    return 'ScanResult';
  }
  return null;
}

function isTaggedNode(value: any): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length === 1 && /^[A-Z]/.test(keys[0]);
}

function walkNode(
  tag: string,
  nodeData: any,
  actualCallback: Walker,
  parent: NodePath | null,
  keyPath: readonly (string | number)[],
): void {
  if (typeof nodeData !== 'object' || nodeData === null) {
    return;
  }

  const path = new NodePath(tag, nodeData, parent, keyPath);

  if (actualCallback(path) === false) {
    return;
  }

  const nodeSpec = schemaMap.get(tag);
  if (nodeSpec) {
    for (const field of nodeSpec.fields) {
      // Check if field type is 'Node' or any other node type (e.g., 'WithClause', 'SelectStmt', etc.)
      const isNodeType = field.type === 'Node' || schemaMap.has(field.type);
      if (isNodeType && nodeData[field.name] != null) {
        const value = nodeData[field.name];
        if (field.isArray && Array.isArray(value)) {
          value.forEach((item, index) => {
            walkFieldValue(item, field.type, actualCallback, path, [...path.keyPath, field.name, index]);
          });
        } else if (!field.isArray) {
          walkFieldValue(value, field.type, actualCallback, path, [...path.keyPath, field.name]);
        }
      }
    }
  } else {
    for (const key in nodeData) {
      const value = nodeData[key];
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            walk(item, actualCallback, path, [...path.keyPath, key, index]);
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        walk(value, actualCallback, path, [...path.keyPath, key]);
      }
    }
  }
}

function walkFieldValue(
  value: any,
  declaredType: string,
  actualCallback: Walker,
  parent: NodePath | null,
  keyPath: readonly (string | number)[],
): void {
  if (typeof value !== 'object' || value === null) {
    return;
  }
  // Concrete typed fields (e.g. CreatePolicyStmt.table: RangeVar) are stored
  // as bare untagged objects in libpg_query JSON — synthesize the tag from
  // the runtime schema so the visitor is dispatched for them.
  if (
    declaredType !== 'Node' &&
    schemaMap.has(declaredType) &&
    !isTaggedNode(value)
  ) {
    walkNode(declaredType, value, actualCallback, parent, keyPath);
  } else {
    walk(value, actualCallback, parent, keyPath);
  }
}

export type VisitorContext = {
  path: (string | number)[];
  parent: any;
  key: string | number;
};

export function visit(
  node: any,
  visitor: { [key: string]: (node: any, ctx: VisitorContext) => void },
  ctx: VisitorContext = { path: [], parent: null, key: '' }
): void {
  if (node == null || typeof node !== 'object') return;

  const rootTag = detectUntaggedRootTag(node);
  if (rootTag) {
    visitNode(rootTag, node, visitor, ctx);
    return;
  }

  const nodeType = Object.keys(node)[0] as string;
  const nodeData = node[nodeType];

  visitNode(nodeType, nodeData, visitor, ctx);
}

function visitNode(
  nodeType: string,
  nodeData: any,
  visitor: { [key: string]: (node: any, ctx: VisitorContext) => void },
  ctx: VisitorContext
): void {
  const visitFn = visitor[nodeType];
  if (visitFn) {
    visitFn(nodeData, ctx);
  }

  const nodeSpec = schemaMap.get(nodeType);

  for (const key in nodeData) {
    const value = (nodeData as any)[key];
    const field = nodeSpec?.fields.find((f) => f.name === key);
    const concreteType =
      field && field.type !== 'Node' && schemaMap.has(field.type)
        ? field.type
        : null;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          const itemCtx: VisitorContext = {
            parent: value,
            key: index,
            path: [...ctx.path, key, index],
          };
          if (concreteType && !isTaggedNode(item)) {
            visitNode(concreteType, item, visitor, itemCtx);
          } else if (Object.keys(item).length === 1) {
            visit(item, visitor, itemCtx);
          }
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      const valueCtx: VisitorContext = {
        parent: nodeData,
        key,
        path: [...ctx.path, key],
      };
      if (concreteType && !isTaggedNode(value)) {
        visitNode(concreteType, value, visitor, valueCtx);
      } else if (Object.keys(value).length === 1) {
        visit(value, visitor, valueCtx);
      }
    }
  }
}
