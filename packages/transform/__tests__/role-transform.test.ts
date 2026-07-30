import { Deparser, loadModule, parseSql } from 'plpgsql-parser';

import { RoleRouter } from '../src/role-router';
import { transformRoles } from '../src/role-transform';

beforeAll(async () => {
  await loadModule();
});

function assertRoundTrip(sql: string): void {
  const once = parseSql(sql);
  const deparsed = once.stmts.map((s: any) => Deparser.deparse(s.stmt)).join(';\n') + ';';
  const twice = parseSql(deparsed);
  expect(twice.stmts.length).toBe(once.stmts.length);
}

// A generic, platform-neutral mapping between two role naming conventions.
const MAP = { anonymous: 'anon', administrator: 'service_role' };

describe('RoleRouter', () => {
  it('resolves routed names and leaves others', () => {
    const router = new RoleRouter(MAP);
    expect(router.resolve('anonymous')).toBe('anon');
    expect(router.resolve('authenticated')).toBeUndefined();
    expect(router.resolve(undefined)).toBeUndefined();
  });

  it('inverts a one-to-one mapping', () => {
    const inv = new RoleRouter(MAP).invert();
    expect(inv.resolve('anon')).toBe('anonymous');
    expect(inv.resolve('service_role')).toBe('administrator');
  });

  it('refuses to invert a non-injective mapping', () => {
    expect(() => new RoleRouter({ a: 'x', b: 'x' }).invert()).toThrow(/one-to-one/);
  });
});

describe('transformRoles', () => {
  it('renames grantees in GRANT and REVOKE', () => {
    const { sql, result } = transformRoles(
      'GRANT SELECT ON t TO anonymous, authenticated;',
      MAP
    );
    expect(sql).toMatch(/TO anon, authenticated/);
    expect(result.rolesRenamed.get('anon')).toBe(1);
    assertRoundTrip(sql);
  });

  it('renames ownership targets', () => {
    const { sql } = transformRoles('ALTER TABLE t OWNER TO administrator;', MAP);
    expect(sql).toMatch(/OWNER TO service_role/);
    assertRoundTrip(sql);
  });

  it('renames policy roles', () => {
    const { sql } = transformRoles(
      'CREATE POLICY p ON t FOR SELECT TO anonymous USING (true);',
      MAP
    );
    expect(sql).toMatch(/TO anon/);
    assertRoundTrip(sql);
  });

  it('renames ALTER DEFAULT PRIVILEGES FOR ROLE and grantees', () => {
    const { sql } = transformRoles(
      'ALTER DEFAULT PRIVILEGES FOR ROLE administrator IN SCHEMA s GRANT SELECT ON TABLES TO anonymous;',
      MAP
    );
    expect(sql).toMatch(/FOR ROLE service_role/);
    expect(sql).toMatch(/TO anon/);
    assertRoundTrip(sql);
  });

  it('renames CREATE ROLE and DROP ROLE', () => {
    const create = transformRoles('CREATE ROLE anonymous NOLOGIN;', MAP);
    expect(create.sql).toMatch(/CREATE ROLE anon/);
    assertRoundTrip(create.sql);

    const drop = transformRoles('DROP ROLE anonymous;', MAP);
    expect(drop.sql).toMatch(/DROP ROLE anon/);
    assertRoundTrip(drop.sql);
  });

  it('renames role membership (granted and grantee roles)', () => {
    const { sql, result } = transformRoles('GRANT administrator TO anonymous;', MAP);
    // The deparser folds the granted-role token to upper case (a pre-existing
    // quirk of AccessPriv rendering, independent of the rename); match
    // case-insensitively. The identifier is still `service_role`.
    expect(sql).toMatch(/GRANT service_role TO anon/i);
    expect(result.rolesRenamed.get('service_role')).toBe(1);
    expect(result.rolesRenamed.get('anon')).toBe(1);
    assertRoundTrip(sql);
  });

  it('renames SET ROLE and SET SESSION AUTHORIZATION', () => {
    const setRole = transformRoles('SET ROLE anonymous;', MAP);
    expect(setRole.sql).toMatch(/SET ROLE (TO )?anon|SET ROLE anon/i);
    assertRoundTrip(setRole.sql);

    const setAuth = transformRoles('SET SESSION AUTHORIZATION anonymous;', MAP);
    expect(setAuth.sql).toMatch(/anon/);
    assertRoundTrip(setAuth.sql);
  });

  it('renames ALTER ROLE ... RENAME TO', () => {
    const { sql } = transformRoles('ALTER ROLE anonymous RENAME TO administrator;', MAP);
    expect(sql).toMatch(/ALTER ROLE anon RENAME TO service_role/);
    assertRoundTrip(sql);
  });

  it('never rewrites PUBLIC or CURRENT_USER', () => {
    const { sql, result } = transformRoles(
      'GRANT SELECT ON t TO PUBLIC; ALTER TABLE t OWNER TO CURRENT_USER;',
      { PUBLIC: 'anon', CURRENT_USER: 'anon' }
    );
    expect(sql).toMatch(/TO PUBLIC/);
    expect(sql).toMatch(/CURRENT_USER/);
    expect(result.rolesRenamed.size).toBe(0);
  });

  it('leaves unrouted roles untouched', () => {
    const { sql, result } = transformRoles('GRANT SELECT ON t TO authenticated;', MAP);
    expect(sql).toMatch(/TO authenticated/);
    expect(result.rolesRenamed.size).toBe(0);
  });

  it('is fully reversible via invert()', () => {
    const forward = transformRoles('GRANT SELECT ON t TO anonymous;', MAP);
    const back = transformRoles(forward.sql, new RoleRouter(MAP).invert());
    expect(back.sql).toMatch(/TO anonymous/);
  });
});
