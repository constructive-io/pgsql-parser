import {
  CategoryProfile,
  ChangeCategory,
  TIER_PROFILE
} from './categorize';
import { classifyStatements, QualifiedName, StatementFacts } from './facts';

/**
 * A change plus its deploy SQL. Optional plan `dependencies` (from `pgpm.plan`)
 * are followed as authoritative prerequisites in addition to AST-derived edges.
 */
export interface ClosureInputChange {
  name: string;
  sql: string;
  dependencies?: string[];
}

/** Why a change ended up in the closure. */
export type ClosureReason = 'selected' | 'prerequisite' | 'fixture';

/**
 * A change included in the closure, with its category and the reason it was pulled.
 */
export interface ClosureChange {
  name: string;
  category: ChangeCategory;
  reason: ClosureReason;
}

/**
 * The fixture closure of a schema slice.
 *
 * Everything the selected changes need to actually *work*: schema/functionality
 * prerequisites they depend on, plus the fixtures that attach to them (policies,
 * grants, RLS enables, role bindings, seed rows / SPRT-style support changes).
 * References that nothing in the input produces are surfaced in `unresolved`
 * rather than silently dropped.
 */
export interface FixtureClosure {
  /** Full closure (selection + prerequisites + fixtures) in input/plan order. */
  order: string[];
  /** Per-change detail in the same order as {@link order}. */
  changes: ClosureChange[];
  /** Closure members categorized as security/fixtures (attached fixtures). */
  fixtures: string[];
  /** Non-selected schema/functionality members pulled in as prerequisites. */
  prerequisites: string[];
  /** Roles required across the closure. */
  roles: string[];
  /** Requirements no input change produces — explicit, never dropped. */
  unresolved: {
    objects: QualifiedName[];
    schemas: string[];
    roles: string[];
  };
}

export interface ResolveFixtureClosureOptions {
  /** Category profile used to label changes (default {@link TIER_PROFILE}). */
  profile?: CategoryProfile;
  /**
   * When false, do not follow AST references from selected changes to their
   * schema/functionality producers (only pull attached fixtures + plan deps).
   * Default true.
   */
  includePrerequisites?: boolean;
}

function objectKey(schema: string | null, name: string): string {
  return `${schema ?? ''}\u0000${name}`;
}

interface ChangeAnalysis {
  name: string;
  category: ChangeCategory;
  facts: StatementFacts[];
  /** Declared plan dependencies (authoritative prerequisites). */
  dependencies: string[];
  /** Objects this change creates (for producer indexing). */
  creates: QualifiedName[];
  /** Schemas this change creates. */
  createsSchemas: string[];
  /** Roles this change creates (CreateRoleStmt). */
  createsRoles: string[];
  /** Schema-qualified objects this change requires. */
  needsObjects: QualifiedName[];
  /** Schemas this change requires. */
  needsSchemas: string[];
  /** Roles this change requires (excludes roles it creates itself). */
  needsRoles: string[];
  /** True when categorized as an attached fixture (security/fixtures). */
  isFixture: boolean;
}

function analyze(change: ClosureInputChange, profile: CategoryProfile): ChangeAnalysis {
  const facts = classifyStatements(change.sql);
  const category = profile.categorize(facts, change.name);

  const creates: QualifiedName[] = [];
  const createsSchemas: string[] = [];
  const createsRoles: string[] = [];
  const needsObjects: QualifiedName[] = [];
  const needsSchemas = new Set<string>();
  const needsRoles = new Set<string>();

  for (const f of facts) {
    for (const c of f.creates) {
      if (f.kind === 'schema') createsSchemas.push(c.name);
      else {
        creates.push(c);
        if (c.schema) needsSchemas.add(c.schema);
      }
    }
    if (f.nodeTag === 'CreateRoleStmt') createsRoles.push(...f.roles);

    for (const r of [...f.references, ...f.fkTargets]) {
      if (r.schema) needsObjects.push(r);
    }
    for (const s of f.referencedSchemas) needsSchemas.add(s);
  }

  const created = new Set(createsRoles);
  for (const f of facts) {
    if (f.nodeTag === 'CreateRoleStmt') continue;
    for (const role of f.roles) if (!created.has(role)) needsRoles.add(role);
  }
  for (const s of createsSchemas) needsSchemas.delete(s);

  return {
    name: change.name,
    category,
    facts,
    dependencies: change.dependencies ?? [],
    creates,
    createsSchemas,
    createsRoles,
    needsObjects,
    needsSchemas: [...needsSchemas],
    needsRoles: [...needsRoles],
    isFixture: category === 'security' || category === 'fixtures'
  };
}

/**
 * Resolve the fixture closure of a schema slice.
 *
 * Pure and deterministic — no I/O — and runs to a fixpoint in both directions:
 *   - forward: a selected change pulls in the producers of the objects/schemas/
 *     roles it references, plus its declared plan dependencies (prerequisites);
 *   - reverse: any fixture (security/fixtures-tier change) that attaches to an
 *     object already in the closure is pulled in (attached fixtures), and then
 *     resolved for its own prerequisites.
 *
 * Output order follows the input (plan) order, so it stays deploy-safe.
 */
export function resolveFixtureClosure(
  allChanges: ClosureInputChange[],
  selection: string[],
  options: ResolveFixtureClosureOptions = {}
): FixtureClosure {
  const profile = options.profile ?? TIER_PROFILE;
  const includePrerequisites = options.includePrerequisites ?? true;

  const analyses = allChanges.map(c => analyze(c, profile));
  const byName = new Map(analyses.map(a => [a.name, a]));

  const producerByObject = new Map<string, string>();
  const producerBySchema = new Map<string, string>();
  const producerByRole = new Map<string, string>();
  for (const a of analyses) {
    for (const c of a.creates) {
      const key = objectKey(c.schema, c.name);
      if (!producerByObject.has(key)) producerByObject.set(key, a.name);
    }
    for (const s of a.createsSchemas) {
      if (!producerBySchema.has(s)) producerBySchema.set(s, a.name);
    }
    for (const r of a.createsRoles) {
      if (!producerByRole.has(r)) producerByRole.set(r, a.name);
    }
  }

  const reason = new Map<string, ClosureReason>();
  for (const name of selection) {
    if (byName.has(name)) reason.set(name, 'selected');
  }

  const producedObjectKeys = new Set<string>();
  const producedSchemas = new Set<string>();
  const refreshProduced = (): void => {
    producedObjectKeys.clear();
    producedSchemas.clear();
    for (const name of reason.keys()) {
      const a = byName.get(name)!;
      for (const c of a.creates) producedObjectKeys.add(objectKey(c.schema, c.name));
      for (const s of a.createsSchemas) producedSchemas.add(s);
    }
  };

  let changed = true;
  while (changed) {
    changed = false;

    // forward: pull producers of what current members need
    for (const name of [...reason.keys()]) {
      const a = byName.get(name)!;
      const pull = (producer: string | undefined, r: ClosureReason): void => {
        if (!producer || reason.has(producer)) return;
        const pa = byName.get(producer)!;
        reason.set(producer, pa.isFixture ? 'fixture' : r);
        changed = true;
      };
      for (const dep of a.dependencies) {
        pull(byName.has(dep) ? dep : undefined, 'prerequisite');
      }
      if (!includePrerequisites) continue;
      for (const o of a.needsObjects) pull(producerByObject.get(objectKey(o.schema, o.name)), 'prerequisite');
      for (const s of a.needsSchemas) pull(producerBySchema.get(s), 'prerequisite');
      for (const role of a.needsRoles) pull(producerByRole.get(role), 'prerequisite');
    }

    // reverse: pull attached fixtures that target current members
    refreshProduced();
    for (const a of analyses) {
      if (reason.has(a.name) || !a.isFixture) continue;
      const objectAttaches =
        a.needsObjects.some(o => producedObjectKeys.has(objectKey(o.schema, o.name))) ||
        a.creates.some(c => producedObjectKeys.has(objectKey(c.schema, c.name)));
      // Schema-scoped fixtures (e.g. ALTER DEFAULT PRIVILEGES IN SCHEMA x) name no
      // specific object; attach them by schema. Object-scoped fixtures attach only
      // via their object refs, so a shared schema does not drag in every fixture.
      const schemaScoped = a.needsObjects.length === 0 && a.creates.length === 0;
      const schemaAttaches =
        schemaScoped &&
        (a.needsSchemas.some(s => producedSchemas.has(s)) ||
          a.createsSchemas.some(s => producedSchemas.has(s)));
      if (objectAttaches || schemaAttaches) {
        reason.set(a.name, 'fixture');
        changed = true;
      }
    }
  }

  const order = analyses.filter(a => reason.has(a.name)).map(a => a.name);
  const changes: ClosureChange[] = order.map(name => {
    const a = byName.get(name)!;
    return { name, category: a.category, reason: reason.get(name)! };
  });

  const roles = new Set<string>();
  const unresolvedObjects: QualifiedName[] = [];
  const unresolvedObjectKeys = new Set<string>();
  const unresolvedSchemas = new Set<string>();
  const unresolvedRoles = new Set<string>();

  for (const name of order) {
    const a = byName.get(name)!;
    for (const role of a.needsRoles) {
      roles.add(role);
      if (!producerByRole.has(role)) unresolvedRoles.add(role);
    }
    for (const o of a.needsObjects) {
      const key = objectKey(o.schema, o.name);
      if (!producerByObject.has(key) && !unresolvedObjectKeys.has(key)) {
        unresolvedObjectKeys.add(key);
        unresolvedObjects.push(o);
      }
    }
    for (const s of a.needsSchemas) {
      if (!producerBySchema.has(s)) unresolvedSchemas.add(s);
    }
  }

  return {
    order,
    changes,
    fixtures: changes.filter(c => c.reason === 'fixture').map(c => c.name),
    prerequisites: changes.filter(c => c.reason === 'prerequisite').map(c => c.name),
    roles: [...roles],
    unresolved: {
      objects: unresolvedObjects,
      schemas: [...unresolvedSchemas],
      roles: [...unresolvedRoles]
    }
  };
}
