/**
 * Schema routing for the core transform.
 *
 * The schema transform historically rewrote every reference to a source
 * schema to a single target schema (`Map<oldSchema, newSchema>`). That is the
 * degenerate, whole-schema case of a more general question asked at every
 * schema-qualified occurrence:
 *
 *   given a reference to `(schema, name)` in namespace `ns`, what schema
 *   should it live in now?
 *
 * A {@link SchemaRouter} answers exactly that. It unifies two dimensions:
 *
 * - **schema-level** default: move everything in a source schema to one target
 *   (the classic `Map` behaviour), and
 * - **object-level** routes: send a specific object — a table, a function, a
 *   type — to its own target schema, independent of its siblings.
 *
 * Object routes are bucketed by PostgreSQL namespace (`relations`, `functions`,
 * `types` — matching `pg_class` / `pg_proc` / `pg_type`), mirroring the routing
 * model already used by {@link qualifyUnqualified}. Resolution is
 * object-route-first, then the schema-level default, then "leave unchanged".
 *
 * An object route may also *rebind* — change the object's **name**, not just
 * the schema it lives in. Routing preserves identity (the same function, a new
 * address); rebinding repoints a reference at a *different* object, which is
 * what lets one implementation of a contract be substituted for another:
 *
 * ```ts
 * { auth: { functions: { uid: { schema: null, name: 'current_user_id' } } } }
 * // auth.uid()  ->  current_user_id()
 * ```
 *
 * A `null` target schema de-qualifies the reference (relying on `search_path`),
 * matching the convention used by the extension router.
 */

/** PostgreSQL object namespaces relevant to schema routing. */
export type ObjectNamespace = 'relation' | 'function' | 'type';

/**
 * A namespace hint for a schema-qualified occurrence. `schema` marks an
 * operation on the schema itself (CREATE/DROP/GRANT ON SCHEMA, search_path);
 * `unknown` marks a site whose namespace cannot be determined statically, in
 * which case only the schema-level default applies.
 */
export type RouteNamespace = ObjectNamespace | 'schema' | 'unknown';

/**
 * Where a specific object should be reached instead. Either field may be
 * omitted: omitting `schema` keeps the schema-level default (or the current
 * schema when the route has none), and omitting `name` keeps the object's own
 * name — so `{ name }` alone is a pure rebind and `{ schema }` alone is
 * equivalent to the shorthand string form.
 */
export interface ObjectRoute {
  /** Target schema, or `null` to make the reference unqualified. */
  schema?: string | null;
  /** Target object name — rebinds the reference to a different object. */
  name?: string;
}

/**
 * An object route target. The shorthand `string` form is the target schema,
 * identical to `{ schema: target }`.
 */
export type ObjectRouteTarget = string | ObjectRoute;

/** Per-source-schema routing: a schema-level default plus per-object routes. */
export interface SchemaRoute {
  /**
   * Schema-level default: every object in this source schema that has no more
   * specific object route moves here. Omit to route *only* the named objects
   * and leave the rest (and the schema itself) untouched.
   */
  schema?: string;
  /** Relation name (table/view/sequence/matview) → target schema or rebind. */
  relations?: Record<string, ObjectRouteTarget>;
  /** Function/procedure/aggregate name → target schema or rebind. */
  functions?: Record<string, ObjectRouteTarget>;
  /** Type/domain name → target schema or rebind. */
  types?: Record<string, ObjectRouteTarget>;
}

/** The full routing specification: one {@link SchemaRoute} per source schema. */
export type RouteSpec = Record<string, SchemaRoute>;

const NS_BUCKET: Record<ObjectNamespace, keyof Pick<SchemaRoute, 'relations' | 'functions' | 'types'>> = {
  relation: 'relations',
  function: 'functions',
  type: 'types'
};

/**
 * Resolves the target schema for any schema-qualified occurrence, unifying the
 * whole-schema `Map` behaviour and per-object routing behind one `resolve`.
 */
export class SchemaRouter {
  private readonly routes: Map<string, SchemaRoute>;

  constructor(routes: RouteSpec | Map<string, SchemaRoute> = {}) {
    this.routes = routes instanceof Map ? new Map(routes) : new Map(Object.entries(routes));
  }

  /** Build a router from the classic whole-schema `Map<oldSchema,newSchema>`. */
  static fromSchemaMap(mapping: Map<string, string> | Record<string, string>): SchemaRouter {
    const entries = mapping instanceof Map ? [...mapping.entries()] : Object.entries(mapping);
    const spec: RouteSpec = {};
    for (const [from, to] of entries) spec[from] = { schema: to };
    return new SchemaRouter(spec);
  }

  /** Coerce a `Map`, plain mapping, or existing router into a router. */
  static from(source: SchemaRouter | Map<string, string> | Record<string, string>): SchemaRouter {
    if (source instanceof SchemaRouter) return source;
    return SchemaRouter.fromSchemaMap(source);
  }

  /** True when this router might rewrite something in `sourceSchema`. */
  has(sourceSchema: string | undefined | null): boolean {
    if (!sourceSchema) return false;
    return this.routes.has(sourceSchema);
  }

  /** True when the router carries no routes at all. */
  get size(): number {
    return this.routes.size;
  }

  /**
   * True when any route targets individual objects (as opposed to whole
   * schemas). Object routes require AST-precise rewriting of opaque function
   * bodies; whole-schema routes are handled by the cheaper string passes.
   */
  hasObjectRoutes(): boolean {
    for (const route of this.routes.values()) {
      if (route.relations || route.functions || route.types) return true;
    }
    return false;
  }

  /**
   * True when any object route changes a name or de-qualifies (rather than
   * only moving between schemas). Such rewrites cannot be expressed by the
   * string-level passes at all, so callers use this to require the AST path.
   */
  hasNameRebinds(): boolean {
    return this.nameRebinds().length > 0;
  }

  /**
   * Every object route that rebinds a name or de-qualifies, keyed by source
   * schema and namespace. Callers use this to report or verify substitutions.
   */
  nameRebinds(): Array<{ schema: string; ns: ObjectNamespace; from: string; to: ObjectRoute }> {
    const out: Array<{ schema: string; ns: ObjectNamespace; from: string; to: ObjectRoute }> = [];
    for (const [schema, route] of this.routes) {
      for (const ns of ['relation', 'function', 'type'] as ObjectNamespace[]) {
        const bucket = route[NS_BUCKET[ns]];
        if (!bucket) continue;
        for (const [from, target] of Object.entries(bucket)) {
          if (typeof target === 'string') continue;
          if (target.name === undefined && target.schema !== null) continue;
          out.push({ schema, ns, from, to: target });
        }
      }
    }
    return out;
  }

  /** Every source schema this router may touch. */
  sourceSchemas(): string[] {
    return [...this.routes.keys()];
  }

  /**
   * Resolve the target schema for `(sourceSchema, name)` in namespace `ns`,
   * or `undefined` to leave it unchanged. Object routes win over the
   * schema-level default; the default applies to schema-level operations and
   * to any object without a specific route.
   */
  resolve(
    sourceSchema: string | undefined | null,
    name?: string,
    ns: RouteNamespace = 'unknown'
  ): string | undefined {
    // A `null` target de-qualifies the reference; the schema-only API cannot
    // express that, so it reads as "unchanged" here.
    return this.resolveObject(sourceSchema, name, ns)?.schema ?? undefined;
  }

  /**
   * Resolve the full target for `(sourceSchema, name)` in namespace `ns` — both
   * the schema the reference should live in and, when the route rebinds, the
   * name it should be reached by. Returns `undefined` to leave it unchanged.
   *
   * In the result, `schema` is `null` when the reference should become
   * unqualified and `undefined` when only the name changes; `name` is
   * `undefined` when only the schema changes.
   */
  resolveObject(
    sourceSchema: string | undefined | null,
    name?: string,
    ns: RouteNamespace = 'unknown'
  ): ObjectRoute | undefined {
    if (!sourceSchema) return undefined;
    const route = this.routes.get(sourceSchema);
    if (!route) return undefined;

    if (name && (ns === 'relation' || ns === 'function' || ns === 'type')) {
      const target = route[NS_BUCKET[ns]]?.[name];
      if (target !== undefined) {
        if (typeof target === 'string') return { schema: target };
        // An object route naming no schema inherits the schema-level default,
        // so a pure rebind leaves placement alone.
        return {
          schema: target.schema !== undefined ? target.schema : route.schema,
          name: target.name
        };
      }
    }
    return route.schema !== undefined ? { schema: route.schema } : undefined;
  }

  /**
   * Source schemas whose *every* object is guaranteed to move — i.e. those
   * with a schema-level default. After a transform, none of these should
   * survive as a qualifier; partially-routed schemas may legitimately remain,
   * so they are excluded from the strict leftover check.
   */
  fullyMovedSchemas(): Map<string, string> {
    const out = new Map<string, string>();
    for (const [from, route] of this.routes) {
      if (route.schema !== undefined) out.set(from, route.schema);
    }
    return out;
  }

  /**
   * A flat schema-level view (`oldSchema → newSchema`) for legacy string-level
   * passes and comment/verify/JSON rewrites that operate per source schema.
   * Only schema-level defaults are included; object-only routes carry no single
   * schema answer and are omitted.
   */
  schemaLevelMap(): Map<string, string> {
    return this.fullyMovedSchemas();
  }
}
