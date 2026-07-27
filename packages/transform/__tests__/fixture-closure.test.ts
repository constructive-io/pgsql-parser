import { loadModule } from 'plpgsql-parser';

import { ClosureInputChange, resolveFixtureClosure } from '../src/fixture-closure';

beforeAll(async () => {
  await loadModule();
});

// A small module: two schemas, tables, a policy + grant + RLS (security),
// a seed insert (fixtures), and a trigger function (functionality).
const CHANGES: ClosureInputChange[] = [
  { name: 'schemas/app_public/schema', sql: 'CREATE SCHEMA app_public;' },
  { name: 'schemas/app_private/schema', sql: 'CREATE SCHEMA app_private;' },
  {
    name: 'schemas/app_public/tables/orgs',
    sql: 'CREATE TABLE app_public.orgs (id uuid PRIMARY KEY);',
    dependencies: ['schemas/app_public/schema']
  },
  {
    name: 'schemas/app_public/tables/users',
    sql: 'CREATE TABLE app_public.users (id uuid PRIMARY KEY, org_id uuid REFERENCES app_public.orgs (id));',
    dependencies: ['schemas/app_public/schema']
  },
  {
    name: 'schemas/app_private/tables/sprt_org_members',
    sql: 'CREATE TABLE app_private.sprt_org_members (user_id uuid, org_id uuid REFERENCES app_public.orgs (id));',
    dependencies: ['schemas/app_private/schema']
  },
  {
    name: 'schemas/app_public/policies/users_select',
    sql: `CREATE POLICY users_select ON app_public.users FOR SELECT TO authenticated
            USING (org_id IN (SELECT org_id FROM app_private.sprt_org_members));`
  },
  {
    name: 'schemas/app_public/grants/users_grant',
    sql: 'GRANT SELECT ON app_public.users TO authenticated;'
  },
  {
    name: 'schemas/app_public/rls/users_enable',
    sql: 'ALTER TABLE app_public.users ENABLE ROW LEVEL SECURITY;'
  },
  {
    name: 'schemas/app_public/seed/default_org',
    sql: "INSERT INTO app_public.orgs (id) VALUES ('00000000-0000-0000-0000-000000000000');"
  },
  // an entirely unrelated table (same schema) that must NOT be pulled in
  {
    name: 'schemas/other/tables/widgets',
    sql: 'CREATE TABLE app_public.widgets (id uuid PRIMARY KEY);',
    dependencies: ['schemas/app_public/schema']
  },
  // a grant on the unrelated table — shares the schema but must NOT attach to users
  {
    name: 'schemas/other/grants/widgets_grant',
    sql: 'GRANT SELECT ON app_public.widgets TO authenticated;'
  }
];

describe('resolveFixtureClosure', () => {
  it('pulls prerequisites and attached fixtures for a selected table', () => {
    const closure = resolveFixtureClosure(CHANGES, ['schemas/app_public/tables/users']);

    // prerequisites: schema + FK target table
    expect(closure.order).toContain('schemas/app_public/schema');
    expect(closure.order).toContain('schemas/app_public/tables/orgs');

    // attached fixtures: policy, grant, RLS enable, and the seed on orgs
    expect(closure.fixtures).toEqual(
      expect.arrayContaining([
        'schemas/app_public/policies/users_select',
        'schemas/app_public/grants/users_grant',
        'schemas/app_public/rls/users_enable',
        'schemas/app_public/seed/default_org'
      ])
    );

    // the policy references the SPRT table -> its prerequisite is pulled too
    expect(closure.order).toContain('schemas/app_private/tables/sprt_org_members');
    expect(closure.order).toContain('schemas/app_private/schema');

    // unrelated table and its grant stay out despite sharing the schema
    expect(closure.order).not.toContain('schemas/other/tables/widgets');
    expect(closure.order).not.toContain('schemas/other/grants/widgets_grant');
  });

  it('is deterministic and preserves plan order', () => {
    const a = resolveFixtureClosure(CHANGES, ['schemas/app_public/tables/users']);
    const b = resolveFixtureClosure(CHANGES, ['schemas/app_public/tables/users']);
    expect(a).toEqual(b);

    const planOrder = CHANGES.map(c => c.name);
    const positions = a.order.map(n => planOrder.indexOf(n));
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
  });

  it('reports required roles and surfaces unresolved external roles', () => {
    const closure = resolveFixtureClosure(CHANGES, ['schemas/app_public/tables/users']);
    // `authenticated` is referenced by policy/grant but created by no change
    expect(closure.roles).toContain('authenticated');
    expect(closure.unresolved.roles).toContain('authenticated');
  });

  it('labels each closure member with a category and reason', () => {
    const closure = resolveFixtureClosure(CHANGES, ['schemas/app_public/tables/users']);
    const users = closure.changes.find(c => c.name === 'schemas/app_public/tables/users')!;
    const policy = closure.changes.find(c => c.name === 'schemas/app_public/policies/users_select')!;
    const orgs = closure.changes.find(c => c.name === 'schemas/app_public/tables/orgs')!;

    expect(users.reason).toBe('selected');
    expect(users.category).toBe('schema');
    expect(policy.reason).toBe('fixture');
    expect(policy.category).toBe('security');
    expect(orgs.reason).toBe('prerequisite');
  });

  it('can skip prerequisites while still pulling attached fixtures', () => {
    const closure = resolveFixtureClosure(CHANGES, ['schemas/app_public/tables/users'], {
      includePrerequisites: false
    });
    // still pulls the fixtures attached to users
    expect(closure.fixtures).toEqual(
      expect.arrayContaining(['schemas/app_public/grants/users_grant'])
    );
    // but does not walk references to the FK target as a prerequisite
    expect(closure.order).not.toContain('schemas/app_public/tables/orgs');
  });
});
