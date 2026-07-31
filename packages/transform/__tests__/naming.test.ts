import { loadModule } from 'plpgsql-parser';

import { classifyStatements } from '../src/facts';
import { identityOf } from '../src/naming';

beforeAll(async () => {
  await loadModule();
});

const idOf = (sql: string) => identityOf(classifyStatements(sql)[0]);

describe('identityOf', () => {
  it('derives identities per object kind', () => {
    expect(idOf('CREATE SCHEMA app;')).toEqual({ kind: 'schema', schema: null, name: 'app' });
    expect(idOf('CREATE TABLE app.users (id int);')).toEqual({ kind: 'table', schema: 'app', name: 'users' });
    expect(idOf('CREATE VIEW app.v_users AS SELECT 1;')).toEqual({ kind: 'view', schema: 'app', name: 'v_users' });
    expect(idOf('CREATE FUNCTION app.fn() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;'))
      .toEqual({ kind: 'function', schema: 'app', name: 'fn' });
    expect(idOf("CREATE TYPE app.status AS ENUM ('a');")).toEqual({ kind: 'type', schema: 'app', name: 'status' });
    expect(idOf('CREATE SEQUENCE app.seq;')).toEqual({ kind: 'sequence', schema: 'app', name: 'seq' });
    expect(idOf('CREATE EXTENSION pgcrypto;')).toEqual({ kind: 'extension', schema: null, name: 'pgcrypto' });
  });

  it('scopes triggers, policies, and indexes to their table', () => {
    expect(idOf(
      'CREATE TRIGGER trg BEFORE INSERT ON app.users FOR EACH ROW EXECUTE FUNCTION app.fn();'
    )).toEqual({ kind: 'trigger', schema: 'app', name: 'trg', table: 'users' });
    expect(idOf('CREATE POLICY p ON app.users USING (true);'))
      .toEqual({ kind: 'policy', schema: 'app', name: 'p', table: 'users' });
    expect(idOf('CREATE INDEX users_email_idx ON app.users (email);'))
      .toEqual({ kind: 'index', schema: 'app', name: 'users_email_idx', table: 'users' });
  });

  it('targets ALTER TABLE constraint statements at their table', () => {
    expect(idOf('ALTER TABLE app.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);'))
      .toEqual({ kind: 'constraint', schema: 'app', name: 'users', table: 'users' });
  });

  it('returns null for statements with no identity of their own', () => {
    expect(idOf('GRANT SELECT ON app.users TO reader;')).toBeNull();
    expect(idOf("COMMENT ON TABLE app.users IS 'x';")).toBeNull();
  });

  it('leaves schema null when unqualified (resolution is a consumer concern)', () => {
    expect(idOf('CREATE TABLE users (id int);')).toEqual({ kind: 'table', schema: null, name: 'users' });
  });
});
