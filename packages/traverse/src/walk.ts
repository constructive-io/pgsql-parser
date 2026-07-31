/**
 * Unified AST traversal.
 *
 * `walk` is the single entry point for every AST shape in the ecosystem — a
 * parsed script, a `ParseResult`, a lone SQL node, or a PL/pgSQL function body —
 * layered over the two primitives in this package:
 *
 *   - `walkSqlAst`     SQL nodes, driven by the runtime schema
 *   - `walkPlpgsqlAst` PL/pgSQL nodes, bridging into hydrated SQL expressions
 *
 * On top of dispatch it adds the three things the primitives cannot provide,
 * because they see one node at a time and never the statement it belongs to:
 *
 *   1. a {@link WalkContext} on every callback (`stmtTag`, `isWrite`, `isRead`,
 *      `insideFunction`, `functionName`)
 *   2. visitor composition — N visitors in a single pass, each free to mix SQL
 *      and `PLpgSQL_*` tags in the same object
 *   3. `ctx.abort()`, which ends the whole walk (returning `false` from a
 *      handler still means "skip this node's children")
 *
 * Parsing lives one layer up: `plpgsql-parser`'s `walkSql(sqlText, ...)` parses
 * and hydrates, then delegates here.
 */

import type { PlpgsqlNodePath, PlpgsqlVisitor,PlpgsqlWalker } from './plpgsql';
import { walkPlpgsqlAst } from './plpgsql';
import type { Visitor as SqlVisitor, Walker as SqlWalker } from './traverse';
import { NodePath, walkSqlAst } from './traverse';

/** Statement tags that write data. */
export const WRITE_STATEMENTS: ReadonlySet<string> = new Set([
  'InsertStmt',
  'UpdateStmt',
  'DeleteStmt',
  'MergeStmt',
  'TruncateStmt',
  'CopyStmt',
]);

/** Statement tags that only read data. */
export const READ_STATEMENTS: ReadonlySet<string> = new Set([
  'SelectStmt',
  'ExplainStmt',
  'DeclareCursorStmt',
  'FetchStmt',
]);

/**
 * Statement-level context threaded through every visitor callback. The node
 * path tells you *where* a node sits; the context tells you *what it is part
 * of* — which statement, whether that statement writes, and whether you are
 * inside a function body.
 */
export interface WalkContext {
  /** Tag of the enclosing top-level statement, or `null` when walking a bare node. */
  readonly stmtTag: string | null;
  /** Index of the enclosing statement within the script, or `-1` if unknown. */
  readonly stmtIndex: number;
  /** Whether the enclosing statement writes data. */
  readonly isWrite: boolean;
  /** Whether the enclosing statement only reads data. */
  readonly isRead: boolean;
  /** Whether this node came from inside a PL/pgSQL function body. */
  readonly insideFunction: boolean;
  /** Dotted name of the enclosing function, when known. */
  readonly functionName: string | null;
  /** End the entire walk. Unlike returning `false`, no further nodes are visited. */
  abort(reason?: string): void;
}

export type UnifiedWalker = (
  path: NodePath | PlpgsqlNodePath,
  ctx: WalkContext,
) => boolean | void;

/**
 * Visitor keyed by node tag. SQL tags (`SelectStmt`, `RangeVar`, ...) and
 * PL/pgSQL tags (`PLpgSQL_stmt_dynexecute`, ...) may be mixed freely. The
 * reserved `statement` key fires once per top-level statement, before its
 * children are visited.
 */
export type UnifiedVisitor = {
  [tag: string]: UnifiedWalker;
};

export interface WalkOptions {
  /** Walk hydrated PL/pgSQL function bodies of a parsed script. Default: true */
  walkFunctionBodies?: boolean;
  /** Recurse into hydrated SQL expressions inside PL/pgSQL bodies. Default: true */
  walkSqlExpressions?: boolean;
  /**
   * Visitor for hydrated SQL expressions inside PL/pgSQL bodies. Defaults to
   * the visitors passed to `walk`, so one visitor object covers both universes.
   */
  sqlVisitor?: SqlVisitor | SqlWalker;
}

export interface WalkResult {
  /** Whether a visitor called `ctx.abort()`. */
  aborted: boolean;
  /** The first abort reason, if one was given. */
  reason?: string;
  /** Every abort reason, in call order. */
  reasons: string[];
}

/** Thrown internally by `ctx.abort()` to unwind the primitives, which have no abort of their own. */
class AbortWalk extends Error {
  constructor() {
    super('walk aborted');
    this.name = 'AbortWalk';
  }
}

const RESERVED_STATEMENT_KEY = 'statement';

/**
 * Walk any AST with one or more visitors.
 *
 * Dispatch is by shape:
 *
 * | Input                                    | Walked                                        |
 * | ---------------------------------------- | --------------------------------------------- |
 * | `{ sql, functions }` (parsed script)     | every statement, then every hydrated body     |
 * | `{ stmts: [...] }` (parse result)        | every statement, with statement context       |
 * | `{ PLpgSQL_*: ... }`                     | PL/pgSQL body, descending into hydrated SQL   |
 * | any other SQL node                       | the SQL node                                  |
 * | an array                                 | each element                                  |
 */
export function walk(
  root: any,
  visitors: UnifiedVisitor | UnifiedWalker | Array<UnifiedVisitor | UnifiedWalker>,
  options: WalkOptions = {},
): WalkResult {
  const list = Array.isArray(visitors) ? visitors : [visitors];
  const result: WalkResult = { aborted: false, reason: undefined, reasons: [] };

  const ctxBase = {
    abort(reason?: string) {
      if (reason !== undefined) {
        result.reasons.push(reason);
      }
      if (!result.aborted) {
        result.aborted = true;
        result.reason = reason;
      }
      throw new AbortWalk();
    },
  };

  const makeContext = (fields: Omit<WalkContext, 'abort'>): WalkContext =>
    Object.assign({}, fields, ctxBase);

  /** Fire every visitor for one node. Returns false if any asks to skip children. */
  const fire = (path: NodePath | PlpgsqlNodePath, ctx: WalkContext): boolean => {
    let descend = true;
    for (const visitor of list) {
      const handler: UnifiedWalker | undefined =
        typeof visitor === 'function' ? visitor : visitor[path.tag];
      if (!handler) continue;
      if (handler(path, ctx) === false) descend = false;
    }
    return descend;
  };

  /**
   * Fire the reserved `statement` hook. Bare walker functions are called for
   * every node already, so they are not called again here.
   */
  const fireStatement = (path: NodePath, ctx: WalkContext): boolean => {
    let descend = true;
    for (const visitor of list) {
      if (typeof visitor === 'function') continue;
      const handler = visitor[RESERVED_STATEMENT_KEY];
      if (handler && handler(path, ctx) === false) descend = false;
    }
    return descend;
  };

  const sqlCallback = (ctx: WalkContext): SqlWalker => (path: NodePath) =>
    fire(path, ctx) ? undefined : false;

  const plpgsqlCallback = (ctx: WalkContext): PlpgsqlWalker => (path: PlpgsqlNodePath) =>
    fire(path, ctx) ? undefined : false;

  const bareContext = (): WalkContext =>
    makeContext({
      stmtTag: null,
      stmtIndex: -1,
      isWrite: false,
      isRead: false,
      insideFunction: false,
      functionName: null,
    });

  /**
   * Walk a whole `ParseResult` in one `walkSqlAst` pass — the SQL walker knows
   * how to reach untagged `RawStmt` entries and every other typed field, which
   * hand-rolled per-statement iteration does not. Statement context is derived
   * on the fly: traversal is depth-first and statements are sequential, so
   * every node after a `RawStmt` belongs to that statement.
   */
  const walkParseResult = (parseResult: any): void => {
    let ctx = bareContext();

    const callback: SqlWalker = (path: NodePath) => {
      if (path.tag !== 'RawStmt') {
        return fire(path, ctx) ? undefined : false;
      }

      const stmt = path.node?.stmt;
      const stmtTag = stmt ? Object.keys(stmt)[0] : null;
      const last = path.keyPath[path.keyPath.length - 1];
      ctx = makeContext({
        stmtTag,
        stmtIndex: typeof last === 'number' ? last : -1,
        isWrite: stmtTag != null && WRITE_STATEMENTS.has(stmtTag),
        isRead: stmtTag != null && READ_STATEMENTS.has(stmtTag),
        insideFunction: false,
        functionName: null,
      });

      let descend = fire(path, ctx);
      if (stmt && stmtTag) {
        const stmtPath = new NodePath(stmtTag, stmt[stmtTag], path, [...path.keyPath, 'stmt']);
        if (!fireStatement(stmtPath, ctx)) descend = false;
      }
      return descend ? undefined : false;
    };

    walkSqlAst(parseResult, callback);
  };

  const walkBody = (hydrated: any, ctx: WalkContext): void => {
    walkPlpgsqlAst(hydrated, plpgsqlCallback(ctx) as PlpgsqlWalker | PlpgsqlVisitor, {
      walkSqlExpressions: options.walkSqlExpressions ?? true,
      sqlVisitor: options.sqlVisitor ?? sqlCallback(ctx),
    });
  };

  const walkAny = (node: any): void => {
    if (node == null || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      node.forEach(walkAny);
      return;
    }

    if (isParsedScript(node)) {
      if (node.sql) walkParseResult(node.sql);
      if (options.walkFunctionBodies ?? true) {
        for (const fn of node.functions ?? []) {
          const hydrated = fn?.plpgsql?.hydrated;
          if (!hydrated) continue;
          walkBody(
            hydrated,
            makeContext({
              stmtTag: 'CreateFunctionStmt',
              stmtIndex: -1,
              isWrite: false,
              isRead: false,
              insideFunction: true,
              functionName: resolveFunctionName(fn.stmt),
            }),
          );
        }
      }
      return;
    }

    // libpg-query returns `{ version, stmts }`; the tagged form appears in
    // fixtures and in ASTs round-tripped through the protobuf types.
    if (Array.isArray(node.stmts)) {
      walkParseResult(node);
      return;
    }
    if (Array.isArray(node.ParseResult?.stmts)) {
      walkParseResult(node);
      return;
    }

    if (isPlpgsqlNode(node)) {
      walkBody(node, bareContext());
      return;
    }

    walkSqlAst(node, sqlCallback(bareContext()));
  };

  try {
    walkAny(root);
  } catch (err) {
    if (!(err instanceof AbortWalk)) throw err;
  }

  return result;
}

function isParsedScript(node: any): boolean {
  return Array.isArray(node.functions) && node.sql != null;
}

/**
 * A hydrated body arrives either as a `{ plpgsql_funcs: [...] }` parse result or
 * as a lone tagged node. Both belong to the PL/pgSQL walker: the SQL walker
 * would descend them generically and never bridge their SQL expressions.
 */
function isPlpgsqlNode(node: any): boolean {
  if (Array.isArray(node.plpgsql_funcs)) return true;
  const keys = Object.keys(node);
  return keys.length === 1 && keys[0].startsWith('PLpgSQL_');
}

/**
 * `ParsedFunction.stmt` is the inner `CreateFunctionStmt` node, but accept the
 * tagged form too so callers can hand us either.
 */
function resolveFunctionName(stmt: any): string | null {
  const funcname = stmt?.funcname ?? stmt?.CreateFunctionStmt?.funcname;
  if (!funcname) return null;
  const name = funcname
    .map((part: any) => part?.String?.sval ?? '')
    .filter(Boolean)
    .join('.');
  return name || null;
}
