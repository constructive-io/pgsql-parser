import { loadModule } from 'plpgsql-parser';

import { classifyStatements } from '../src/facts';

beforeAll(async () => {
  await loadModule();
});

describe('classifyStatements', () => {
  it('classifies schema, table, view, index and type DDL', () => {
    const facts = classifyStatements(`
      CREATE SCHEMA app_public;
      CREATE TABLE app_public.users (id uuid PRIMARY KEY, org_id uuid REFERENCES app_public.orgs (id));
      CREATE VIEW app_public.active_users AS SELECT * FROM app_public.users;
      CREATE INDEX users_org_idx ON app_public.users (org_id);
      CREATE TYPE app_public.status AS ENUM ('on', 'off');
    `);

    expect(facts.map(f => f.kind)).toEqual(['schema', 'table', 'view', 'index', 'type']);
    expect(facts[0].creates).toEqual([{ schema: null, name: 'app_public' }]);
    expect(facts[1].creates).toEqual([{ schema: 'app_public', name: 'users' }]);
    expect(facts[1].fkTargets).toEqual([{ schema: 'app_public', name: 'orgs' }]);
    expect(facts[2].references).toContainEqual({ schema: 'app_public', name: 'users' });
    expect(facts[4].creates).toEqual([{ schema: 'app_public', name: 'status' }]);
  });

  it('flags security statements: policies, grants, RLS enable', () => {
    const facts = classifyStatements(`
      CREATE POLICY users_select ON app_public.users FOR SELECT TO authenticated USING (org_id = app_private.current_org_id());
      GRANT SELECT ON app_public.users TO authenticated, administrator;
      ALTER TABLE app_public.users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE app_public.users FORCE ROW LEVEL SECURITY;
    `);

    expect(facts.map(f => f.kind)).toEqual(['policy', 'grant', 'rls_enable', 'rls_enable']);
    expect(facts.every(f => f.securityRelevant)).toBe(true);
    expect(facts[0].roles).toEqual(['authenticated']);
    expect(facts[0].references).toContainEqual({ schema: 'app_private', name: 'current_org_id' });
    expect(facts[1].roles).toEqual(['authenticated', 'administrator']);
  });

  it('captures the guarded table of a policy via the generic walker', () => {
    const facts = classifyStatements(`
      CREATE POLICY users_select ON app_public.users FOR SELECT USING (true);
    `);

    expect(facts[0].creates).toEqual([{ schema: 'app_public', name: 'users.users_select' }]);
    expect(facts[0].references).toContainEqual({ schema: 'app_public', name: 'users' });
  });

  it('classifies FK constraints added via ALTER TABLE', () => {
    const facts = classifyStatements(`
      ALTER TABLE app_public.users ADD CONSTRAINT users_org_fkey FOREIGN KEY (org_id) REFERENCES billing.orgs (id);
      ALTER TABLE app_public.users ADD CONSTRAINT users_email_uniq UNIQUE (email);
    `);

    expect(facts[0].kind).toBe('fk_constraint');
    expect(facts[0].fkTargets).toEqual([{ schema: 'billing', name: 'orgs' }]);
    expect(facts[0].referencedSchemas).toContain('billing');
    expect(facts[1].kind).toBe('constraint');
  });

  it('extracts references from PL/pgSQL function bodies', () => {
    const facts = classifyStatements(`
      CREATE FUNCTION app_public.quota_gate_tg() RETURNS trigger AS $$
      BEGIN
        IF (SELECT count(*) FROM billing.usage_log WHERE org_id = NEW.org_id) > 100 THEN
          RAISE EXCEPTION 'quota exceeded';
        END IF;
        PERFORM store.release_usage(NEW.id);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    expect(facts).toHaveLength(1);
    expect(facts[0].kind).toBe('function');
    expect(facts[0].creates).toEqual([{ schema: 'app_public', name: 'quota_gate_tg' }]);
    expect(facts[0].references).toContainEqual({ schema: 'billing', name: 'usage_log' });
    expect(facts[0].references).toContainEqual({ schema: 'store', name: 'release_usage' });
    expect(facts[0].referencedSchemas).toEqual(expect.arrayContaining(['billing', 'store']));
  });

  it('extracts references from LANGUAGE sql string bodies', () => {
    const facts = classifyStatements(`
      CREATE FUNCTION catalog.product_slug() RETURNS text AS $$
        SELECT catalog.slugify(name) FROM catalog.products LIMIT 1;
      $$ LANGUAGE sql STABLE;
    `);

    expect(facts).toHaveLength(1);
    expect(facts[0].creates).toEqual([{ schema: 'catalog', name: 'product_slug' }]);
    // references inside the opaque LANGUAGE sql body are discovered
    expect(facts[0].references).toContainEqual({ schema: 'catalog', name: 'products' });
    expect(facts[0].references).toContainEqual({ schema: 'catalog', name: 'slugify' });
    expect(facts[0].bodyReferences).toContainEqual({ schema: 'catalog', name: 'products' });
    // the function does not depend on itself
    expect(facts[0].references).not.toContainEqual({ schema: 'catalog', name: 'product_slug' });
  });

  it('does not treat a C-language function body string as SQL', () => {
    const facts = classifyStatements(
      `CREATE FUNCTION ext.thing() RETURNS void AS 'MODULE_PATHNAME', 'thing_fn' LANGUAGE c;`
    );
    expect(facts[0].creates).toEqual([{ schema: 'ext', name: 'thing' }]);
    expect(facts[0].references).toEqual([]);
  });

  it('separates body-only references as late-binding bodyReferences', () => {
    const facts = classifyStatements(`
      CREATE FUNCTION app_public.quota_gate(org app_types.org_ref) RETURNS boolean
      LANGUAGE plpgsql AS $$
      BEGIN
        RETURN (SELECT count(*) FROM billing.usage_log) < 100;
      END;
      $$;
    `);

    expect(facts[0].references).toContainEqual({ schema: 'billing', name: 'usage_log' });
    expect(facts[0].bodyReferences).toEqual([{ schema: 'billing', name: 'usage_log' }]);
    // signature type is not body-only
    expect(facts[0].bodyReferences).not.toContainEqual({ schema: 'app_types', name: 'org_ref' });
    expect(facts[0].references).toContainEqual({ schema: 'app_types', name: 'org_ref' });
  });

  it('classifies triggers with their function reference', () => {
    const facts = classifyStatements(`
      CREATE TRIGGER timestamps_tg BEFORE INSERT ON app_public.users
      FOR EACH ROW EXECUTE PROCEDURE app_private.tg_timestamps();
    `);

    expect(facts[0].kind).toBe('trigger');
    expect(facts[0].creates).toEqual([{ schema: 'app_public', name: 'users.timestamps_tg' }]);
    expect(facts[0].references).toContainEqual({ schema: 'app_private', name: 'tg_timestamps' });
  });

  it('classifies seed DML with its target', () => {
    const facts = classifyStatements(`
      INSERT INTO app_public.db_presets (name) VALUES ('default');
    `);

    expect(facts[0].kind).toBe('seed_dml');
    expect(facts[0].creates).toEqual([{ schema: 'app_public', name: 'db_presets' }]);
  });

  it('ignores pg_catalog and unqualified references', () => {
    const facts = classifyStatements(`
      CREATE TABLE app_public.t (id int4, n numeric);
      SELECT count(*) FROM unqualified_table;
    `);

    expect(facts[0].references).toEqual([]);
    expect(facts[1].references).toEqual([]);
  });

  it('does not modify input and is safe to call repeatedly', () => {
    const sql = `CREATE POLICY p ON a.t USING (x = b.f());`;
    const first = classifyStatements(sql);
    const second = classifyStatements(sql);
    expect(second).toEqual(first);
  });

  it('collects ownership changes as security-relevant with roles', () => {
    const facts = classifyStatements(`
      ALTER TABLE app_public.users OWNER TO administrator;
    `);
    expect(facts[0].securityRelevant).toBe(true);
    expect(facts[0].roles).toEqual(['administrator']);
  });

  it('classifies CREATE EXTENSION with and without a schema clause', () => {
    const facts = classifyStatements(`
      CREATE EXTENSION pgcrypto;
      CREATE EXTENSION IF NOT EXISTS pg_partman WITH SCHEMA partman;
    `);
    expect(facts.map(f => f.kind)).toEqual(['extension', 'extension']);
    expect(facts[0].extension).toEqual({
      name: 'pgcrypto',
      schema: null,
      action: 'create',
      ifNotExists: false
    });
    expect(facts[1].extension).toEqual({
      name: 'pg_partman',
      schema: 'partman',
      action: 'create',
      ifNotExists: true
    });
  });

  it('classifies ALTER EXTENSION ... SET SCHEMA and DROP EXTENSION', () => {
    const facts = classifyStatements(`
      ALTER EXTENSION pg_partman SET SCHEMA public;
      DROP EXTENSION IF EXISTS pgcrypto CASCADE;
    `);
    expect(facts.map(f => f.kind)).toEqual(['extension', 'extension']);
    expect(facts[0].extension).toEqual({
      name: 'pg_partman',
      schema: 'public',
      action: 'set_schema'
    });
    expect(facts[1].extension).toEqual({
      name: 'pgcrypto',
      schema: null,
      action: 'drop'
    });
  });

  it('does not classify non-extension ALTER ... SET SCHEMA as extension', () => {
    const facts = classifyStatements(`ALTER TABLE app.t SET SCHEMA app2;`);
    expect(facts[0].kind).not.toBe('extension');
    expect(facts[0].extension).toBeUndefined();
  });
});
