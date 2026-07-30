/**
 * Role-name routing for the core transform.
 *
 * Two databases can express the *same* access model with *different* role
 * names — one calls the unauthenticated role `anonymous`, another `anon`; one
 * calls the privileged role `administrator`, another something else. Portable
 * SQL must be able to translate role identifiers between these conventions.
 *
 * Scope, deliberately narrow: a {@link RoleRouter} only renames role
 * *identifiers* in the AST positions where a role name legitimately appears
 * (grants, ownership, policies, default privileges, role membership, role
 * settings). It does **not** alter role *attributes* (`BYPASSRLS`, `LOGIN`,
 * ...): two roles that share a name across conventions do not necessarily
 * share privilege scope, and inventing attribute changes would silently
 * misrepresent the security model. Privilege-semantics reconciliation is a
 * downstream, policy-level concern; the router restricts itself to the
 * deterministic, reversible part — the name.
 *
 * Renaming is a pure identifier substitution, so a router is trivially
 * invertible ({@link RoleRouter.invert}) for bidirectional translation.
 */

/** Role-rename specification: source role name -> target role name. */
export type RoleRouteSpec = Record<string, string>;

/** Resolves a target role name for a source role name. */
export class RoleRouter {
  private readonly map: Map<string, string>;

  constructor(routes: RoleRouteSpec | Map<string, string> = {}) {
    this.map = routes instanceof Map ? new Map(routes) : new Map(Object.entries(routes));
  }

  /** Coerce a spec, map, or existing router into a router. */
  static from(source: RoleRouter | RoleRouteSpec | Map<string, string>): RoleRouter {
    return source instanceof RoleRouter ? source : new RoleRouter(source);
  }

  /** Number of configured renames. */
  get size(): number {
    return this.map.size;
  }

  /**
   * Resolve the target name for `role`, or `undefined` when it is not routed
   * or already at its destination.
   */
  resolve(role: string | undefined | null): string | undefined {
    if (!role) return undefined;
    const target = this.map.get(role);
    if (target === undefined || target === role) return undefined;
    return target;
  }

  /**
   * The inverse router (target -> source), for translating in the opposite
   * direction. Throws if the mapping is not one-to-one.
   */
  invert(): RoleRouter {
    const inverted = new Map<string, string>();
    for (const [from, to] of this.map) {
      if (inverted.has(to)) {
        throw new Error(`RoleRouter.invert: mapping is not one-to-one (two sources map to "${to}")`);
      }
      inverted.set(to, from);
    }
    return new RoleRouter(inverted);
  }
}
