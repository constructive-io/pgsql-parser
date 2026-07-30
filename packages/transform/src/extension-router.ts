/**
 * Extension routing for the core transform.
 *
 * A PostgreSQL extension is installed into exactly one schema, and the objects
 * it provides (functions, types, operators) live in that schema. Two databases
 * can install the *same* extension into *different* schemas — one leaves it in
 * `public`, another isolates it in a dedicated schema — so portable SQL must be
 * able to move an extension's install site **and** rewrite every reference to
 * the symbols it provides.
 *
 * This is a distinct problem from {@link SchemaRouter}, which routes objects the
 * SQL itself creates. Here the objects are owned by an extension and are not
 * declared in the script; the only way to know that a bare `crypt(...)` call
 * belongs to `pgcrypto` (and must move when `pgcrypto` moves) is an
 * **inventory** of which symbols each extension provides. That inventory is
 * also **version-aware**: a symbol can graduate into the server core and cease
 * to be extension-owned (the canonical case is `gen_random_uuid()`, provided by
 * `pgcrypto` before PostgreSQL 13 and part of core `pg_catalog` from 13 on — it
 * must never be routed on 13+).
 *
 * An {@link ExtensionRouter} answers two questions:
 *
 * - **install**: where should `CREATE EXTENSION <e>` (or `ALTER EXTENSION <e>
 *   SET SCHEMA`) place the extension?
 * - **reference**: given a reference to a symbol `(schema, name)` in namespace
 *   `ns`, what schema should it live in now — including stripping the qualifier
 *   entirely (relying on `search_path`) when the target is "unqualified".
 *
 * A schema of `null` denotes the **unqualified** site: a bare reference
 * (`crypt(...)`) or installing an extension with no explicit `SCHEMA` clause.
 * This makes the router fully bidirectional: `null -> 'extensions'` qualifies
 * bare references, and `'extensions' -> null` strips them back to bare.
 */

/** PostgreSQL namespaces an extension symbol can occupy. */
export type ExtensionSymbolNamespace = 'function' | 'type' | 'operator';

/** A single symbol provided by an extension. */
export interface ExtensionSymbol {
  /** Bare symbol name (e.g. `crypt`, `citext`, `gen_random_uuid`). */
  name: string;
  /** Which namespace the symbol occupies. Defaults to `function`. */
  namespace?: ExtensionSymbolNamespace;
  /**
   * Major PostgreSQL version at/after which this symbol is part of the server
   * core (`pg_catalog`) rather than the extension. At or above this version
   * the symbol is **never routed** — it resolves from `pg_catalog` regardless
   * of where the extension lives. The classic case is `gen_random_uuid`
   * (`coreSince: 13`).
   */
  coreSince?: number;
}

/** The set of symbols an extension provides. */
export interface ExtensionDefinition {
  /** Extension name as used in `CREATE EXTENSION <name>`. */
  name: string;
  /**
   * Whether the extension is relocatable (`ALTER EXTENSION ... SET SCHEMA`
   * succeeds). Informational for callers deciding *how* to move an existing
   * install; the router never emits `SET SCHEMA` itself.
   */
  relocatable?: boolean;
  /**
   * A schema the extension is pinned to and cannot be moved out of (fixed by
   * its control file, e.g. a geocoder that always creates its own schema).
   * When set, the router refuses to route the extension's install or symbols.
   */
  fixedSchema?: string;
  /** Symbols the extension provides. */
  symbols: ExtensionSymbol[];
}

/**
 * A routing rule for one extension. `to` is the destination install/reference
 * schema (or `null` to strip qualification / install without a `SCHEMA`
 * clause). `from` lists the schemas currently holding the extension that
 * should be rewritten; a `null` entry additionally routes bare references.
 * When `from` is omitted, references in **any** schema (and bare ones) are
 * routed — useful when the source layout is unknown.
 */
export interface ExtensionRoute {
  to: string | null;
  from?: (string | null)[];
}

/** Routing specification keyed by extension name. */
export type ExtensionRouteSpec = Record<string, ExtensionRoute>;

/** A concrete rewrite instruction: from a schema (or bare) to a schema (or bare). */
export interface SymbolRewrite {
  /** Target schema, or `null` to make the reference unqualified. */
  to: string | null;
}

export interface ExtensionRouterOptions {
  /**
   * The symbol inventory. Defaults to {@link COMMON_EXTENSIONS}. Callers can
   * pass an augmented or replacement inventory (e.g. extended from live-catalog
   * introspection).
   */
  inventory?: ExtensionDefinition[];
  /**
   * Target PostgreSQL major version, used to apply {@link ExtensionSymbol.coreSince}.
   * Defaults to a high value so version-graduated symbols (e.g. `gen_random_uuid`)
   * are treated as core and never routed unless a caller opts into an older
   * version.
   */
  serverVersion?: number;
}

const DEFAULT_SERVER_VERSION = 9999;

/**
 * A curated, platform-agnostic inventory of common contrib/extension symbols.
 * Intentionally minimal and conservative — only well-known, stable symbols are
 * listed so routing never touches something it cannot prove belongs to the
 * extension. Callers extend this via {@link ExtensionRouterOptions.inventory}.
 */
export const COMMON_EXTENSIONS: ExtensionDefinition[] = [
  {
    name: 'pgcrypto',
    relocatable: true,
    symbols: [
      { name: 'crypt' },
      { name: 'gen_salt' },
      { name: 'digest' },
      { name: 'hmac' },
      { name: 'encrypt' },
      { name: 'decrypt' },
      { name: 'encrypt_iv' },
      { name: 'decrypt_iv' },
      { name: 'gen_random_bytes' },
      // Provided by pgcrypto before PG13; part of core pg_catalog from 13 on.
      { name: 'gen_random_uuid', coreSince: 13 },
      { name: 'pgp_sym_encrypt' },
      { name: 'pgp_sym_decrypt' },
      { name: 'pgp_pub_encrypt' },
      { name: 'pgp_pub_decrypt' }
    ]
  },
  {
    name: 'uuid-ossp',
    relocatable: true,
    symbols: [
      { name: 'uuid_generate_v1' },
      { name: 'uuid_generate_v1mc' },
      { name: 'uuid_generate_v3' },
      { name: 'uuid_generate_v4' },
      { name: 'uuid_generate_v5' },
      { name: 'uuid_nil' }
    ]
  },
  {
    name: 'citext',
    relocatable: true,
    symbols: [
      { name: 'citext', namespace: 'type' },
      { name: 'citextin', namespace: 'function' },
      { name: 'citext_hash', namespace: 'function' }
    ]
  },
  {
    name: 'pg_trgm',
    relocatable: true,
    symbols: [
      { name: 'similarity' },
      { name: 'show_trgm' },
      { name: 'word_similarity' },
      { name: 'strict_word_similarity' }
    ]
  },
  {
    name: 'ltree',
    relocatable: true,
    symbols: [
      { name: 'ltree', namespace: 'type' },
      { name: 'lquery', namespace: 'type' },
      { name: 'ltxtquery', namespace: 'type' },
      { name: 'subltree' },
      { name: 'subpath' },
      { name: 'nlevel' },
      { name: 'lca' }
    ]
  },
  {
    name: 'hstore',
    relocatable: true,
    symbols: [{ name: 'hstore', namespace: 'type' }]
  },
  {
    name: 'unaccent',
    relocatable: true,
    symbols: [{ name: 'unaccent' }]
  }
];

interface IndexedSymbol {
  extension: string;
  coreSince?: number;
}

/**
 * Resolves install-schema and symbol-reference routing for extensions, backed
 * by a version-aware symbol inventory.
 */
export class ExtensionRouter {
  private readonly routes: Map<string, ExtensionRoute>;
  private readonly serverVersion: number;
  private readonly definitions: Map<string, ExtensionDefinition>;
  /** `${namespace}:${name}` -> providing extension (+ version predicate). */
  private readonly symbolIndex: Map<string, IndexedSymbol>;

  constructor(routes: ExtensionRouteSpec | Map<string, ExtensionRoute> = {}, options: ExtensionRouterOptions = {}) {
    this.routes = routes instanceof Map ? new Map(routes) : new Map(Object.entries(routes));
    this.serverVersion = options.serverVersion ?? DEFAULT_SERVER_VERSION;
    const inventory = options.inventory ?? COMMON_EXTENSIONS;
    this.definitions = new Map(inventory.map(def => [def.name, def]));
    this.symbolIndex = new Map();
    for (const def of inventory) {
      for (const sym of def.symbols) {
        const key = symbolKey(sym.namespace ?? 'function', sym.name);
        // First definition wins; inventories should not double-claim a symbol.
        if (!this.symbolIndex.has(key)) {
          this.symbolIndex.set(key, { extension: def.name, coreSince: sym.coreSince });
        }
      }
    }
  }

  /**
   * Build a router that moves the given extensions (default: every inventoried
   * one) to a single `targetSchema`, rewriting their references from `public`
   * and from bare (unqualified) sites. Passing `null` as `targetSchema` strips
   * qualification instead (the "repollute public / rely on search_path"
   * direction).
   */
  static toSchema(
    targetSchema: string | null,
    options: ExtensionRouterOptions & { extensions?: string[]; from?: (string | null)[] } = {}
  ): ExtensionRouter {
    const inventory = options.inventory ?? COMMON_EXTENSIONS;
    const names = options.extensions ?? inventory.map(d => d.name);
    const from = options.from ?? ['public', null];
    const spec: ExtensionRouteSpec = {};
    for (const name of names) spec[name] = { to: targetSchema, from };
    return new ExtensionRouter(spec, options);
  }

  /** Coerce a spec, map, or existing router into a router. */
  static from(
    source: ExtensionRouter | ExtensionRouteSpec | Map<string, ExtensionRoute>,
    options?: ExtensionRouterOptions
  ): ExtensionRouter {
    if (source instanceof ExtensionRouter) return source;
    return new ExtensionRouter(source, options);
  }

  /** True when no extension routes are configured. */
  get size(): number {
    return this.routes.size;
  }

  /** Extension names this router may rewrite. */
  routedExtensions(): string[] {
    return [...this.routes.keys()];
  }

  /** True when any configured extension has inventoried symbols to rewrite. */
  hasSymbolRoutes(): boolean {
    for (const name of this.routes.keys()) {
      const def = this.definitions.get(name);
      if (def && !def.fixedSchema && def.symbols.length > 0) return true;
    }
    return false;
  }

  /**
   * Resolve the install schema for `CREATE EXTENSION <extname>` /
   * `ALTER EXTENSION <extname> SET SCHEMA`. Returns:
   * - a string to place/keep the extension in that schema,
   * - `null` to install with no explicit `SCHEMA` clause (server default),
   * - `undefined` to leave the statement unchanged (no route, or the extension
   *   is pinned to a fixed schema).
   */
  resolveInstall(extname: string | undefined | null): string | null | undefined {
    if (!extname) return undefined;
    const route = this.routes.get(extname);
    if (!route) return undefined;
    if (this.definitions.get(extname)?.fixedSchema !== undefined) return undefined;
    return route.to;
  }

  /**
   * Resolve a rewrite for a reference to `(schema, name)` in namespace `ns`,
   * where `schema` is `null` for a bare reference. Returns the target
   * ({@link SymbolRewrite}) or `undefined` to leave the reference unchanged.
   *
   * A reference is rewritten only when the inventory proves the symbol belongs
   * to a routed extension, the symbol has not graduated to core at the target
   * server version, the current schema is one the route rewrites `from`, and
   * the destination actually differs from where it already is.
   */
  resolveSymbol(
    schema: string | null | undefined,
    name: string | undefined,
    ns: ExtensionSymbolNamespace
  ): SymbolRewrite | undefined {
    if (!name) return undefined;
    const indexed = this.symbolIndex.get(symbolKey(ns, name));
    if (!indexed) return undefined;
    // Graduated into core at/after the target server version — resolves from
    // pg_catalog and must not be tied to the extension's schema.
    if (indexed.coreSince !== undefined && this.serverVersion >= indexed.coreSince) return undefined;

    const route = this.routes.get(indexed.extension);
    if (!route) return undefined;
    if (this.definitions.get(indexed.extension)?.fixedSchema !== undefined) return undefined;

    const current = schema ?? null;
    if (route.from !== undefined && !route.from.includes(current)) return undefined;
    if (current === route.to) return undefined;
    return { to: route.to };
  }
}

function symbolKey(ns: ExtensionSymbolNamespace, name: string): string {
  return `${ns}:${name}`;
}
