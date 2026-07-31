import { loadModule } from 'plpgsql-parser';

import { classifyStatements } from '../src/facts';
import { changePathFor, identityOf, pathFor } from '../src/naming';

beforeAll(async () => {
  await loadModule();
});

const pathOf = (sql: string): string | null => changePathFor(classifyStatements(sql)[0]);

describe('PGPM naming spec v1', () => {
  it('derives canonical paths per object kind', () => {
    expect(pathOf('CREATE SCHEMA app;')).toBe('schemas/app/schema');
    expect(pathOf('CREATE TABLE app.users (id int);')).toBe('schemas/app/tables/users/table');
    expect(pathOf('CREATE VIEW app.v_users AS SELECT 1;')).toBe('schemas/app/views/v_users');
    expect(pathOf('CREATE FUNCTION app.fn() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;'))
      .toBe('schemas/app/procedures/fn');
    expect(pathOf('CREATE TYPE app.status AS ENUM (\'a\');')).toBe('schemas/app/types/status');
    expect(pathOf('CREATE SEQUENCE app.seq;')).toBe('schemas/app/sequences/seq');
    expect(pathOf('CREATE EXTENSION pgcrypto;')).toBe('extensions/pgcrypto');
  });

  it('scopes triggers, policies, and indexes to their table', () => {
    expect(pathOf(
      'CREATE TRIGGER trg BEFORE INSERT ON app.users FOR EACH ROW EXECUTE FUNCTION app.fn();'
    )).toBe('schemas/app/tables/users/triggers/trg');
    expect(pathOf('CREATE POLICY p ON app.users USING (true);'))
      .toBe('schemas/app/tables/users/policies/p');
    expect(pathOf('CREATE INDEX users_email_idx ON app.users (email);'))
      .toBe('schemas/app/tables/users/indexes/users_email_idx');
  });

  it('routes ALTER TABLE constraint statements to the table constraints dir', () => {
    const path = pathOf('ALTER TABLE app.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);');
    expect(path).toBe('schemas/app/tables/users/constraints/users');
  });

  it('returns null for statements with no identity of their own', () => {
    expect(pathOf('GRANT SELECT ON app.users TO reader;')).toBeNull();
    expect(pathOf("COMMENT ON TABLE app.users IS 'x';")).toBeNull();
  });

  it('defaults missing schema to public', () => {
    expect(pathOf('CREATE TABLE users (id int);')).toBe('schemas/public/tables/users/table');
  });

  it('pathFor is total and deterministic over identities', () => {
    expect(pathFor({ kind: 'role', schema: null, name: 'admin' })).toBe('roles/admin');
    expect(pathFor({ kind: 'other', schema: 'app', name: 'thing' })).toBe('schemas/app/objects/thing');
  });

  it('identity is the key, path is the rendering', () => {
    const facts = classifyStatements('CREATE TABLE app.users (id int);')[0];
    const identity = identityOf(facts)!;
    expect(identity).toEqual({ kind: 'table', schema: 'app', name: 'users' });
    expect(pathFor(identity)).toBe('schemas/app/tables/users/table');
  });
});
