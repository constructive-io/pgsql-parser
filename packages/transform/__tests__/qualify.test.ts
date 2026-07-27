import { loadModule } from 'plpgsql-parser';

import {
  collectCreatedObjects,
  mergeInventories,
  qualifyUnqualified
} from '../src/qualify';
import { transformSql } from '../src/transform';

beforeAll(async () => {
  await loadModule();
});

const HANDWRITTEN = `CREATE TABLE users (
  id uuid PRIMARY KEY,
  status user_status NOT NULL DEFAULT 'active'
);
CREATE TYPE user_status AS ENUM ('active', 'disabled');
CREATE TABLE widgets (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES users (id)
);
CREATE FUNCTION get_user(uid uuid) RETURNS users AS $$
  SELECT * FROM users WHERE id = uid
$$ LANGUAGE sql;
GRANT SELECT ON users TO authenticated;`;

describe('collectCreatedObjects', () => {
  it('buckets unqualified creations by namespace', () => {
    const inv = collectCreatedObjects(HANDWRITTEN);
    expect([...inv.relations].sort()).toEqual(['users', 'widgets']);
    expect([...inv.functions]).toEqual(['get_user']);
    expect([...inv.types]).toEqual(['user_status']);
  });

  it('skips creations that are already qualified', () => {
    const inv = collectCreatedObjects('CREATE TABLE app.users (id int);');
    expect(inv.relations.size).toBe(0);
  });

  it('collects sequences as relations', () => {
    const inv = collectCreatedObjects('CREATE SEQUENCE user_id_seq;');
    expect([...inv.relations]).toEqual(['user_id_seq']);
  });

  it('merges inventories across scripts', () => {
    const merged = mergeInventories([
      collectCreatedObjects('CREATE TABLE a (id int);'),
      collectCreatedObjects('CREATE TABLE b (id int);')
    ]);
    expect([...merged.relations].sort()).toEqual(['a', 'b']);
  });
});

describe('qualifyUnqualified', () => {
  it('pins unqualified creations and references to the schema', () => {
    const { sql, result } = qualifyUnqualified(HANDWRITTEN, { schema: 'public' });

    expect(sql).toContain('CREATE TABLE public.users');
    expect(sql).toContain('CREATE TABLE public.widgets');
    expect(sql).toContain('REFERENCES public.users');
    expect(sql).toContain('CREATE TYPE public.user_status');
    expect(sql).toContain('CREATE FUNCTION public.get_user');
    expect(sql).toContain('RETURNS public.users');
    expect(sql).toContain('FROM public.users');
    expect(sql).toContain('GRANT SELECT ON public.users');
    expect(sql).toContain('status public.user_status');

    expect(result.qualified.get('users')).toBeGreaterThanOrEqual(4);
    expect(result.qualified.get('get_user')).toBe(1);
  });

  it('leaves builtins, columns, and unknown names untouched', () => {
    const { sql } = qualifyUnqualified(
      `CREATE TABLE logs (id int, at timestamptz DEFAULT now());
SELECT count(*) FROM logs WHERE at < now();
SELECT * FROM external_table;`,
      { schema: 'public' }
    );
    expect(sql).toContain('now()');
    expect(sql).not.toContain('public.now');
    expect(sql).not.toContain('public.count');
    expect(sql).toContain('FROM public.logs');
    expect(sql).toContain('FROM external_table');
    expect(sql).not.toContain('public.external_table');
  });

  it('does not qualify CTE references that shadow an inventory relation', () => {
    const { sql } = qualifyUnqualified(
      `CREATE TABLE users (id int);
WITH users AS (SELECT 1 AS id) SELECT * FROM users;`,
      { schema: 'public' }
    );
    expect(sql).toContain('CREATE TABLE public.users');
    expect(sql).toMatch(/users AS \(SELECT 1 AS id\)/);
    expect(sql).toContain('FROM users;');
  });

  it('qualifies references inside plpgsql bodies', () => {
    const { sql } = qualifyUnqualified(
      `CREATE TABLE users (id uuid);
CREATE FUNCTION touch() RETURNS trigger AS $$
BEGIN
  UPDATE users SET id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`,
      { schema: 'public' }
    );
    expect(sql).toContain('UPDATE public.users');
  });

  it('accepts an external inventory for cross-script references', () => {
    const inventory = collectCreatedObjects('CREATE TABLE users (id int);');
    const { sql } = qualifyUnqualified('SELECT * FROM users;', {
      schema: 'public',
      inventory
    });
    expect(sql).toContain('FROM public.users');
  });

  it('injects CREATE SCHEMA IF NOT EXISTS when requested and absent', () => {
    const { sql } = qualifyUnqualified('CREATE TABLE users (id int);', {
      schema: 'myapp',
      injectCreateSchema: true
    });
    expect(sql.startsWith('CREATE SCHEMA IF NOT EXISTS myapp;')).toBe(true);
    expect(sql).toContain('CREATE TABLE myapp.users');
  });

  it('does not inject CREATE SCHEMA when the content already creates it', () => {
    const { sql } = qualifyUnqualified(
      'CREATE SCHEMA myapp;\nCREATE TABLE users (id int);',
      { schema: 'myapp', injectCreateSchema: true }
    );
    expect(sql.match(/CREATE SCHEMA/g)).toHaveLength(1);
  });
});

describe('qualifyUnqualified targets (multi-schema routing)', () => {
  const MULTI = `CREATE TYPE widget AS ENUM ('gear', 'gadget');
CREATE TABLE users (id uuid PRIMARY KEY);
CREATE TABLE products (
  id uuid PRIMARY KEY,
  owner uuid REFERENCES users (id),
  kind widget
);
CREATE FUNCTION get_products(uid uuid) RETURNS SETOF products AS $$
  SELECT * FROM products WHERE owner = uid
$$ LANGUAGE sql;
GRANT SELECT ON users TO authenticated;`;

  it('routes tables, types, and functions to different schemas in one pass', () => {
    const { sql, result } = qualifyUnqualified(MULTI, {
      targets: {
        auth: { relations: ['users'] },
        shop: { relations: ['products'], functions: ['get_products'] },
        shared: { types: ['widget'] }
      }
    });

    expect(sql).toContain('CREATE TABLE auth.users');
    expect(sql).toContain('CREATE TABLE shop.products');
    expect(sql).toContain('CREATE TYPE shared.widget');
    expect(sql).toContain('REFERENCES auth.users');
    expect(sql).toContain('kind shared.widget');
    expect(sql).toContain('CREATE FUNCTION shop.get_products');
    expect(sql).toContain('RETURNS SETOF shop.products');
    expect(sql).toContain('FROM shop.products');
    expect(sql).toContain('GRANT SELECT ON auth.users');

    expect(result.routed.get('users')).toBe('auth');
    expect(result.routed.get('products')).toBe('shop');
    expect(result.routed.get('widget')).toBe('shared');
    expect(result.routed.get('get_products')).toBe('shop');
  });

  it('leaves unrouted objects untouched', () => {
    const { sql } = qualifyUnqualified(MULTI, {
      targets: { auth: { relations: ['users'] } }
    });
    expect(sql).toContain('CREATE TABLE auth.users');
    expect(sql).toContain('CREATE TABLE products');
    expect(sql).toContain('CREATE TYPE widget');
    expect(sql).toContain('kind widget');
  });

  it('disambiguates a relation and a type sharing a schema route by namespace', () => {
    const { sql } = qualifyUnqualified(
      `CREATE TYPE status AS ENUM ('on', 'off');
CREATE TABLE devices (id int, state status);`,
      {
        targets: {
          hw: { relations: ['devices'] },
          shared: { types: ['status'] }
        }
      }
    );
    expect(sql).toContain('CREATE TABLE hw.devices');
    expect(sql).toContain('CREATE TYPE shared.status');
    expect(sql).toContain('state shared.status');
  });

  it('injects CREATE SCHEMA IF NOT EXISTS for every missing target schema', () => {
    const { sql } = qualifyUnqualified(MULTI, {
      targets: {
        auth: { relations: ['users'] },
        shop: { relations: ['products'], functions: ['get_products'] },
        shared: { types: ['widget'] }
      },
      injectCreateSchema: true
    });
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS auth;');
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS shop;');
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS shared;');
  });

  it('throws on conflicting routes for the same name and namespace', () => {
    expect(() =>
      qualifyUnqualified('CREATE TABLE users (id int);', {
        targets: {
          a: { relations: ['users'] },
          b: { relations: ['users'] }
        }
      })
    ).toThrow(/conflicting targets for relation "users"/);
  });

  it('rejects passing both schema and targets', () => {
    expect(() =>
      qualifyUnqualified('SELECT 1;', {
        schema: 'public',
        targets: { a: { relations: ['x'] } }
      })
    ).toThrow(/either `schema` or `targets`/);
  });

  it('rejects neither schema nor targets', () => {
    expect(() => qualifyUnqualified('SELECT 1;', {})).toThrow(
      /one of `schema` or `targets` is required/
    );
  });

  it('composes with transformSql for a subsequent rename', () => {
    const { content } = transformSql(
      qualifyUnqualified(MULTI, {
        targets: { auth: { relations: ['users'] }, shop: { relations: ['products'] } }
      }).sql,
      new Map([['auth', 'tenant_auth']])
    );
    expect(content).toContain('CREATE TABLE tenant_auth.users');
    expect(content).toContain('REFERENCES tenant_auth.users');
    expect(content).toContain('CREATE TABLE shop.products');
  });
});

describe('transformSql qualifyUnqualified integration', () => {
  it('ingests handwritten public SQL into a named schema', () => {
    const { content, result } = transformSql(
      HANDWRITTEN,
      new Map([['public', 'myapp']]),
      { qualifyUnqualified: { schema: 'public' } }
    );

    expect(result.errors).toEqual([]);
    expect(content).toContain('CREATE TABLE myapp.users');
    expect(content).toContain('CREATE TABLE myapp.widgets');
    expect(content).toContain('REFERENCES myapp.users');
    expect(content).toContain('CREATE FUNCTION myapp.get_user');
    expect(content).toContain('RETURNS myapp.users');
    expect(content).toContain('FROM myapp.users');
    expect(content).toContain('GRANT SELECT ON myapp.users');
    expect(content).not.toContain('public.');
  });

  it('preserves pgpm headers around a qualified body', () => {
    const withHeader = `-- Deploy schemas/public/tables/users to pg\n\nCREATE TABLE users (id int);`;
    const { content } = transformSql(
      withHeader,
      new Map([['public', 'myapp']]),
      { qualifyUnqualified: { schema: 'public' } }
    );
    expect(content).toContain('-- Deploy schemas/myapp/tables/users to pg');
    expect(content).toContain('CREATE TABLE myapp.users');
  });

  it('descopes a named schema onto public with assumeSchemasExist', () => {
    const { content, result } = transformSql(
      `CREATE SCHEMA myapp;\nCREATE TABLE myapp.users (id int);\nCREATE FUNCTION myapp.get_user() RETURNS myapp.users AS $$ SELECT * FROM myapp.users $$ LANGUAGE sql;`,
      new Map([['myapp', 'public']]),
      { assumeSchemasExist: ['public'] }
    );
    expect(result.errors).toEqual([]);
    expect(content).toContain('CREATE SCHEMA IF NOT EXISTS public');
    expect(content).toContain('CREATE TABLE public.users');
    expect(content).toContain('FROM public.users');
    expect(content).not.toContain('myapp');
  });

  it('defaults to current behavior when the options are unset', () => {
    const { content } = transformSql(HANDWRITTEN, new Map([['public', 'myapp']]));
    // Only explicitly qualified references are rewritten; unqualified stay.
    expect(content).toContain('CREATE TABLE users');
    expect(content).toContain('CREATE TABLE widgets');
    expect(content).toContain('FROM users');
  });
});
