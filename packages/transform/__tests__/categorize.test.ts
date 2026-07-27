import { loadModule } from 'plpgsql-parser';

import { buildCategoryOf, categorizeChange, CategoryProfile, TIER_PROFILE } from '../src/categorize';

beforeAll(async () => {
  await loadModule();
});

describe('categorizeChange (tier profile)', () => {
  it('classifies base DDL as schema', () => {
    expect(categorizeChange('CREATE SCHEMA app_public;', 'schemas/app/schema')).toBe('schema');
    expect(
      categorizeChange('CREATE TABLE app_public.users (id uuid PRIMARY KEY);', 'schemas/app/tables/users')
    ).toBe('schema');
    expect(
      categorizeChange('CREATE INDEX users_org_idx ON app_public.users (org_id);', 'schemas/app/indexes/users_org')
    ).toBe('schema');
  });

  it('classifies functions and triggers as functionality', () => {
    expect(
      categorizeChange(
        'CREATE FUNCTION app_public.touch() RETURNS trigger AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql;',
        'schemas/app/procedures/touch'
      )
    ).toBe('functionality');
    expect(
      categorizeChange(
        'CREATE TRIGGER touch_users BEFORE UPDATE ON app_public.users FOR EACH ROW EXECUTE FUNCTION app_public.touch();',
        'schemas/app/triggers/touch_users'
      )
    ).toBe('functionality');
  });

  it('classifies policies, grants and RLS as security (wins over everything)', () => {
    expect(
      categorizeChange('GRANT SELECT ON app_public.users TO authenticated;', 'schemas/app/grants/users')
    ).toBe('security');
    expect(
      categorizeChange(
        'CREATE POLICY users_select ON app_public.users FOR SELECT TO authenticated USING (true);',
        'schemas/app/policies/users_select'
      )
    ).toBe('security');
    // A change that both creates a table AND enables RLS is pulled into security.
    expect(
      categorizeChange(
        'CREATE TABLE app_public.secrets (id uuid PRIMARY KEY); ALTER TABLE app_public.secrets ENABLE ROW LEVEL SECURITY;',
        'schemas/app/tables/secrets'
      )
    ).toBe('security');
  });

  it('classifies seed DML as fixtures', () => {
    expect(
      categorizeChange("INSERT INTO app_public.settings (key, value) VALUES ('theme', 'dark');", 'seeds/settings')
    ).toBe('fixtures');
  });

  it('defaults empty/unclassifiable SQL to schema', () => {
    expect(categorizeChange('-- just a comment\n', 'schemas/app/noop')).toBe('schema');
  });
});

describe('buildCategoryOf', () => {
  const changeSql: Record<string, string> = {
    'schemas/app/schema': 'CREATE SCHEMA app_public;',
    'schemas/app/tables/users': 'CREATE TABLE app_public.users (id uuid PRIMARY KEY);',
    'schemas/app/procedures/touch':
      'CREATE FUNCTION app_public.touch() RETURNS trigger AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql;',
    'schemas/app/grants/users': 'GRANT SELECT ON app_public.users TO authenticated;',
  };

  it('produces a categoryOf function keyed by change name', () => {
    const categoryOf = buildCategoryOf(changeSql);
    expect(categoryOf('schemas/app/schema')).toBe('schema');
    expect(categoryOf('schemas/app/tables/users')).toBe('schema');
    expect(categoryOf('schemas/app/procedures/touch')).toBe('functionality');
    expect(categoryOf('schemas/app/grants/users')).toBe('security');
  });

  it('returns undefined for changes it never saw (core falls back to folder key)', () => {
    const categoryOf = buildCategoryOf(changeSql);
    expect(categoryOf('schemas/other/unknown')).toBeUndefined();
  });

  it('honors a custom profile', () => {
    // A per-schema profile: the category is the top-level schema segment.
    const bySchema: CategoryProfile = {
      name: 'by-schema',
      categorize: (_facts, changeName) => changeName.split('/')[1] ?? 'root',
    };
    const categoryOf = buildCategoryOf(changeSql, bySchema);
    expect(categoryOf('schemas/app/schema')).toBe('app');
  });

  it('exposes the default profile name', () => {
    expect(TIER_PROFILE.name).toBe('tier');
  });
});
