import { Deparser, loadModule, parseSql } from 'plpgsql-parser';

import { ExtensionRouter } from '../src/extension-router';
import { transformExtensions } from '../src/extension-transform';

beforeAll(async () => {
  await loadModule();
});

/** parse -> deparse -> parse must be stable (structural round-trip). */
function assertRoundTrip(sql: string): void {
  const once = parseSql(sql);
  const deparsed = once.stmts.map((s: any) => Deparser.deparse(s.stmt)).join(';\n') + ';';
  const twice = parseSql(deparsed);
  expect(twice.stmts.length).toBe(once.stmts.length);
}

describe('transformExtensions — install schema (node construction)', () => {
  it('adds a SCHEMA clause to CREATE EXTENSION that has none', () => {
    const { sql, result } = transformExtensions(
      'CREATE EXTENSION pgcrypto;',
      { pgcrypto: { to: 'extensions' } }
    );
    expect(sql).toMatch(/CREATE EXTENSION pgcrypto\s+(WITH\s+)?SCHEMA extensions/i);
    expect(result.installsMoved.get('pgcrypto')).toBe('extensions');
    assertRoundTrip(sql);
  });

  it('changes an existing SCHEMA clause', () => {
    const { sql } = transformExtensions(
      'CREATE EXTENSION pgcrypto WITH SCHEMA public;',
      { pgcrypto: { to: 'extensions' } }
    );
    expect(sql).toMatch(/SCHEMA extensions/i);
    expect(sql).not.toMatch(/SCHEMA public/i);
    assertRoundTrip(sql);
  });

  it('removes the SCHEMA clause when routing to bare (null)', () => {
    const { sql } = transformExtensions(
      'CREATE EXTENSION pgcrypto WITH SCHEMA extensions;',
      { pgcrypto: { to: null } }
    );
    expect(sql).not.toMatch(/SCHEMA/i);
    expect(sql).toMatch(/CREATE EXTENSION pgcrypto/i);
    assertRoundTrip(sql);
  });

  it('preserves IF NOT EXISTS when adding a schema', () => {
    const { sql } = transformExtensions(
      'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
      { pgcrypto: { to: 'extensions' } }
    );
    expect(sql).toMatch(/IF NOT EXISTS/i);
    expect(sql).toMatch(/SCHEMA extensions/i);
    assertRoundTrip(sql);
  });

  it('rewrites ALTER EXTENSION ... SET SCHEMA', () => {
    const { sql, result } = transformExtensions(
      'ALTER EXTENSION pgcrypto SET SCHEMA public;',
      { pgcrypto: { to: 'extensions' } }
    );
    expect(sql).toMatch(/ALTER EXTENSION pgcrypto SET SCHEMA extensions/i);
    expect(result.installsMoved.get('pgcrypto')).toBe('extensions');
    assertRoundTrip(sql);
  });

  it('leaves unrouted extensions untouched', () => {
    const { sql, result } = transformExtensions(
      'CREATE EXTENSION pg_trgm;',
      { pgcrypto: { to: 'extensions' } }
    );
    expect(sql).toMatch(/CREATE EXTENSION pg_trgm/i);
    expect(sql).not.toMatch(/SCHEMA/i);
    expect(result.installsMoved.size).toBe(0);
  });
});

describe('transformExtensions — symbol references (node construction)', () => {
  it('qualifies a bare extension function call', () => {
    const { sql, result } = transformExtensions(
      "SELECT crypt('pw', gen_salt('bf'));",
      ExtensionRouter.toSchema('extensions')
    );
    expect(sql).toMatch(/extensions\.crypt/);
    expect(sql).toMatch(/extensions\.gen_salt/);
    expect(result.symbolsRewritten.get('crypt')).toBe(1);
    assertRoundTrip(sql);
  });

  it('requalifies a public-qualified extension call', () => {
    const { sql } = transformExtensions(
      "SELECT public.digest('x', 'sha256');",
      ExtensionRouter.toSchema('extensions')
    );
    expect(sql).toMatch(/extensions\.digest/);
    expect(sql).not.toMatch(/public\.digest/);
    assertRoundTrip(sql);
  });

  it('strips qualification when routing to bare', () => {
    const { sql } = transformExtensions(
      "SELECT extensions.crypt('pw', extensions.gen_salt('bf'));",
      ExtensionRouter.toSchema(null, { from: ['extensions'] })
    );
    expect(sql).toMatch(/\bcrypt\(/);
    expect(sql).not.toMatch(/extensions\.crypt/);
    assertRoundTrip(sql);
  });

  it('does not touch gen_random_uuid on modern PostgreSQL (core symbol)', () => {
    const { sql, result } = transformExtensions(
      'SELECT gen_random_uuid();',
      ExtensionRouter.toSchema('extensions', { serverVersion: 16 })
    );
    expect(sql).not.toMatch(/extensions\.gen_random_uuid/);
    expect(result.symbolsRewritten.has('gen_random_uuid')).toBe(false);
  });

  it('routes an extension-provided type (citext) in a column definition', () => {
    const { sql } = transformExtensions(
      'CREATE TABLE t (email citext NOT NULL);',
      ExtensionRouter.toSchema('extensions')
    );
    expect(sql).toMatch(/extensions\.citext/);
    assertRoundTrip(sql);
  });

  it('rewrites extension calls inside a LANGUAGE sql body', () => {
    const { sql } = transformExtensions(
      `CREATE FUNCTION hash_pw(pw text) RETURNS text AS $$
         SELECT crypt(pw, gen_salt('bf'))
       $$ LANGUAGE sql;`,
      ExtensionRouter.toSchema('extensions')
    );
    expect(sql).toMatch(/extensions\.crypt/);
    expect(sql).toMatch(/extensions\.gen_salt/);
    assertRoundTrip(sql);
  });

  it('rewrites extension calls inside a PL/pgSQL body', () => {
    const { sql } = transformExtensions(
      `CREATE FUNCTION hash_pw(pw text) RETURNS text AS $$
         BEGIN
           RETURN crypt(pw, gen_salt('bf'));
         END;
       $$ LANGUAGE plpgsql;`,
      ExtensionRouter.toSchema('extensions')
    );
    expect(sql).toMatch(/extensions\.crypt/);
    expect(sql).toMatch(/extensions\.gen_salt/);
    assertRoundTrip(sql);
  });

  it('leaves user-defined lookalikes alone', () => {
    const { sql, result } = transformExtensions(
      'SELECT app.crypt(x), my_helper();',
      ExtensionRouter.toSchema('extensions')
    );
    expect(sql).toMatch(/app\.crypt/);
    expect(sql).toMatch(/my_helper\(\)/);
    expect(result.symbolsRewritten.size).toBe(0);
  });
});
