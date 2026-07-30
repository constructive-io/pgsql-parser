import { loadModule } from 'plpgsql-parser';

import {
  SchemaRouter,
  SchemaTransformResult,
  transformSql,
  transformSqlStatement,
} from '../src';

beforeAll(async () => {
  await loadModule();
});

function freshResult(): SchemaTransformResult {
  return {
    schemasFound: new Set(),
    schemasTransformed: new Map(),
    errors: [],
  };
}

// =============================================================================
// SchemaRouter unit behaviour
// =============================================================================

describe('SchemaRouter', () => {
  it('degenerates to whole-schema behaviour via fromSchemaMap', () => {
    const router = SchemaRouter.fromSchemaMap(new Map([['users', 'tenant_a']]));
    expect(router.resolve('users', 'accounts', 'relation')).toBe('tenant_a');
    expect(router.resolve('users', 'account_count', 'function')).toBe('tenant_a');
    expect(router.resolve('users', undefined, 'schema')).toBe('tenant_a');
    expect(router.resolve('other', 'x', 'relation')).toBeUndefined();
  });

  it('routes individual objects over the schema-level default', () => {
    const router = new SchemaRouter({
      users: {
        schema: 'tenant_a',
        functions: { account_count: 'reporting' },
        types: { user_status: 'shared' },
      },
    });
    // object routes win
    expect(router.resolve('users', 'account_count', 'function')).toBe('reporting');
    expect(router.resolve('users', 'user_status', 'type')).toBe('shared');
    // everything else falls back to the schema-level default
    expect(router.resolve('users', 'accounts', 'relation')).toBe('tenant_a');
    expect(router.resolve('users', undefined, 'schema')).toBe('tenant_a');
  });

  it('supports pure object routing with no schema-level default', () => {
    const router = new SchemaRouter({
      users: {
        relations: { accounts: 'tenant_a' },
        functions: { account_count: 'reporting' },
      },
    });
    expect(router.resolve('users', 'accounts', 'relation')).toBe('tenant_a');
    expect(router.resolve('users', 'account_count', 'function')).toBe('reporting');
    // unlisted object with no default stays put
    expect(router.resolve('users', 'sessions', 'relation')).toBeUndefined();
    expect(router.resolve('users', undefined, 'schema')).toBeUndefined();
  });

  it('keeps namespaces independent (a table and function of the same name)', () => {
    const router = new SchemaRouter({
      app: {
        relations: { widget: 'rel_schema' },
        functions: { widget: 'fn_schema' },
      },
    });
    expect(router.resolve('app', 'widget', 'relation')).toBe('rel_schema');
    expect(router.resolve('app', 'widget', 'function')).toBe('fn_schema');
  });

  it('reports only fully-moved schemas', () => {
    const router = new SchemaRouter({
      whole: { schema: 'moved' },
      partial: { functions: { helper: 'shared' } },
    });
    const moved = router.fullyMovedSchemas();
    expect([...moved.entries()]).toEqual([['whole', 'moved']]);
    expect(router.sourceSchemas().sort()).toEqual(['partial', 'whole']);
  });
});

// =============================================================================
// Object-level routing through transformSql / transformSqlStatement
// =============================================================================

describe('object-level routing (transformSqlStatement)', () => {
  it('routes a table and a function from one source schema to different schemas', () => {
    const router = new SchemaRouter({
      users: {
        relations: { accounts: 'tenant_a' },
        functions: { account_count: 'reporting' },
      },
    });

    const table = transformSqlStatement(
      'CREATE TABLE users.accounts (id int PRIMARY KEY);',
      router,
      freshResult()
    ).sql;
    expect(table).toContain('tenant_a.accounts');
    expect(table).not.toContain('users.accounts');

    const fn = transformSqlStatement(
      'CREATE FUNCTION users.account_count() RETURNS bigint AS $$ SELECT count(*) FROM users.accounts $$ LANGUAGE sql;',
      router,
      freshResult()
    ).sql;
    // the function's own identity is routed to reporting …
    expect(fn).toContain('reporting.account_count');
    // … while the table reference inside its body is routed to tenant_a
    expect(fn).toContain('tenant_a.accounts');
    expect(fn).not.toContain('users.');
  });

  it('routes a cross-object reference inside a PL/pgSQL body', () => {
    const router = new SchemaRouter({
      users: {
        schema: 'tenant_a',
        functions: { account_count: 'reporting' },
      },
    });
    const sql =
      'CREATE FUNCTION users.account_count() RETURNS bigint AS $$\n' +
      'DECLARE n bigint;\n' +
      'BEGIN\n' +
      '  SELECT count(*) INTO n FROM users.accounts;\n' +
      '  RETURN n;\n' +
      'END;\n' +
      '$$ LANGUAGE plpgsql;';
    const out = transformSqlStatement(sql, router, freshResult()).sql;
    expect(out).toContain('reporting.account_count');
    expect(out).toContain('tenant_a.accounts');
    expect(out).not.toContain('users.');
  });

  it('routes DROP statements (revert scripts) by object namespace', () => {
    const router = new SchemaRouter({
      users: {
        relations: { accounts: 'tenant_a' },
        functions: { account_count: 'reporting' },
      },
    });
    const dropFn = transformSqlStatement(
      'DROP FUNCTION users.account_count();',
      router,
      freshResult()
    ).sql;
    expect(dropFn).toContain('reporting.account_count');

    const dropTable = transformSqlStatement(
      'DROP TABLE users.accounts;',
      router,
      freshResult()
    ).sql;
    expect(dropTable).toContain('tenant_a.accounts');
  });

  it('leaves unrouted objects in place when there is no schema-level default', () => {
    const router = new SchemaRouter({
      users: { functions: { account_count: 'reporting' } },
    });
    const out = transformSqlStatement(
      'CREATE TABLE users.accounts (id int PRIMARY KEY);',
      router,
      freshResult()
    ).sql;
    // no route for the table and no default → untouched
    expect(out).toContain('users.accounts');
  });
});

describe('object-level routing (transformSql, full module content)', () => {
  const source =
    '-- Deploy users:schemas/users/procedures/account_count to pg\n' +
    '\n' +
    'CREATE SCHEMA users;\n' +
    'CREATE TABLE users.accounts (id int PRIMARY KEY, email text NOT NULL);\n' +
    'CREATE FUNCTION users.account_count() RETURNS bigint AS $$\n' +
    '  SELECT count(*) FROM users.accounts;\n' +
    '$$ LANGUAGE sql STABLE;\n';

  it('sends everything to a tenant except a shared function, cross-refs intact', () => {
    const router = new SchemaRouter({
      users: {
        schema: 'tenant_a',
        functions: { account_count: 'reporting' },
      },
    });
    const { content, result } = transformSql(source, router, { roundTrip: true });

    // schema + table go to the tenant default
    expect(content).toContain('CREATE SCHEMA tenant_a');
    expect(content).toContain('tenant_a.accounts');
    // the function is routed to the shared schema
    expect(content).toContain('reporting.account_count');
    // and still reads the tenant table
    expect(content).toMatch(/FROM\s+tenant_a\.accounts/);
    // nothing from the source schema survives (validateNoUntransformedSchemas
    // would have thrown otherwise, since `users` is fully moved)
    expect(content).not.toContain('users.');
    expect(result.errors).toHaveLength(0);
  });

  it('honours assumeSchemasExist with a router (idempotent target schema)', () => {
    const router = new SchemaRouter({ users: { schema: 'tenant_b' } });
    const { content } = transformSql(source, router, {
      assumeSchemasExist: ['tenant_b'],
    });
    expect(content).toMatch(/CREATE SCHEMA IF NOT EXISTS tenant_b/);
  });

  it('is identical to a plain Map when only a schema-level default is used', () => {
    const viaMap = transformSql(source, new Map([['users', 'tenant_a']])).content;
    const viaRouter = transformSql(
      source,
      SchemaRouter.fromSchemaMap({ users: 'tenant_a' })
    ).content;
    expect(viaRouter).toEqual(viaMap);
  });
});

// =============================================================================
// Name rebinding (substitution: repoint a reference at a different object)
// =============================================================================

describe('SchemaRouter name rebinding (unit)', () => {
  it('resolves a full rebind target and keeps the schema-only API unchanged', () => {
    const router = new SchemaRouter({
      accounts: {
        functions: { current_actor: { schema: null, name: 'current_user_id' } },
      },
    });
    expect(router.resolveObject('accounts', 'current_actor', 'function')).toEqual({
      schema: null,
      name: 'current_user_id',
    });
    // schema-only API cannot express de-qualification → reads as unchanged
    expect(router.resolve('accounts', 'current_actor', 'function')).toBeUndefined();
  });

  it('inherits the schema-level default for a pure name rebind', () => {
    const router = new SchemaRouter({
      accounts: {
        schema: 'app',
        relations: { members: { name: 'users' } },
      },
    });
    expect(router.resolveObject('accounts', 'members', 'relation')).toEqual({
      schema: 'app',
      name: 'users',
    });
    expect(router.resolve('accounts', 'members', 'relation')).toBe('app');
  });

  it('treats the string shorthand as { schema } and reports rebinds', () => {
    const router = new SchemaRouter({
      accounts: {
        relations: { members: 'app' },
        functions: { current_actor: { schema: null, name: 'current_user_id' } },
      },
    });
    expect(router.resolveObject('accounts', 'members', 'relation')).toEqual({ schema: 'app' });
    expect(router.hasNameRebinds()).toBe(true);
    expect(router.nameRebinds()).toEqual([
      {
        schema: 'accounts',
        ns: 'function',
        from: 'current_actor',
        to: { schema: null, name: 'current_user_id' },
      },
    ]);

    const plain = new SchemaRouter({ accounts: { relations: { members: 'app' } } });
    expect(plain.hasNameRebinds()).toBe(false);
  });
});

describe('name rebinding (transformSqlStatement)', () => {
  it('rebinds a function call site to a different, unqualified function', () => {
    const router = new SchemaRouter({
      accounts: {
        functions: { current_actor: { schema: null, name: 'current_user_id' } },
      },
    });
    const out = transformSqlStatement(
      'ALTER TABLE app.posts ADD COLUMN owner uuid DEFAULT accounts.current_actor();',
      router,
      freshResult()
    ).sql;
    expect(out).toContain('current_user_id()');
    expect(out).not.toContain('accounts.');
    expect(out).not.toContain('current_actor');
  });

  it('rebinds a FK target table to a replacement table in another schema', () => {
    const router = new SchemaRouter({
      accounts: {
        relations: { members: { schema: 'app', name: 'users' } },
      },
    });
    const out = transformSqlStatement(
      'ALTER TABLE storage.objects ADD CONSTRAINT objects_owner_fkey FOREIGN KEY (owner) REFERENCES accounts.members(id);',
      router,
      freshResult()
    ).sql;
    expect(out).toContain('app.users');
    expect(out).not.toContain('accounts.members');
  });

  it('rebinds a call site inside a LANGUAGE sql body', () => {
    const router = new SchemaRouter({
      accounts: {
        functions: { current_actor: { schema: null, name: 'current_user_id' } },
      },
    });
    const out = transformSqlStatement(
      'CREATE FUNCTION app.is_owner(row_owner uuid) RETURNS boolean AS $$ SELECT row_owner = accounts.current_actor() $$ LANGUAGE sql STABLE;',
      router,
      freshResult()
    ).sql;
    expect(out).toContain('current_user_id()');
    expect(out).not.toContain('accounts.current_actor');
  });

  it('rebinds a policy predicate call site', () => {
    const router = new SchemaRouter({
      accounts: {
        functions: { current_actor: { schema: null, name: 'current_user_id' } },
      },
    });
    const out = transformSqlStatement(
      'CREATE POLICY owner_select ON app.posts FOR SELECT USING (owner = accounts.current_actor());',
      router,
      freshResult()
    ).sql;
    expect(out).toContain('current_user_id()');
    expect(out).not.toContain('accounts.');
  });

  it('de-qualifies a relation reference when the target schema is null', () => {
    const router = new SchemaRouter({
      legacy: {
        relations: { settings: { schema: null } },
      },
    });
    const out = transformSqlStatement(
      'SELECT * FROM legacy.settings;',
      router,
      freshResult()
    ).sql;
    expect(out).toContain('FROM settings');
    expect(out).not.toContain('legacy.');
  });

  it('leaves siblings untouched when only one object is rebound', () => {
    const router = new SchemaRouter({
      accounts: {
        functions: { current_actor: { schema: null, name: 'current_user_id' } },
      },
    });
    const out = transformSqlStatement(
      'SELECT accounts.current_actor(), accounts.display_name(1);',
      router,
      freshResult()
    ).sql;
    expect(out).toContain('current_user_id()');
    expect(out).toContain('accounts.display_name(1)');
  });
});
