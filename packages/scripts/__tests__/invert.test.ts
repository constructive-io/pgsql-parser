import { classifyStatements } from '@pgsql/transform';
import { loadModule } from 'plpgsql-parser';

import { revertFor, verifyFor } from '../src/invert';

beforeAll(async () => {
  await loadModule();
});

const revert = (sql: string) => revertFor(classifyStatements(sql));
const verify = (sql: string) => verifyFor(classifyStatements(sql));

describe('revertFor', () => {
  it('inverts CREATE SCHEMA', () => {
    expect(revert('CREATE SCHEMA app;')).toEqual({ sql: 'DROP SCHEMA app;', warnings: [] });
  });

  it('inverts CREATE TABLE', () => {
    expect(revert('CREATE TABLE app.users (id int);')).toEqual({ sql: 'DROP TABLE app.users;', warnings: [] });
  });

  it('inverts CREATE VIEW', () => {
    expect(revert('CREATE VIEW app.v AS SELECT 1;')).toEqual({ sql: 'DROP VIEW app.v;', warnings: [] });
  });

  it('inverts CREATE INDEX into the table schema', () => {
    expect(revert('CREATE INDEX users_email_idx ON app.users (email);'))
      .toEqual({ sql: 'DROP INDEX app.users_email_idx;', warnings: [] });
  });

  it('inverts CREATE SEQUENCE', () => {
    expect(revert('CREATE SEQUENCE app.seq;')).toEqual({ sql: 'DROP SEQUENCE app.seq;', warnings: [] });
  });

  it('inverts CREATE TYPE (enum, composite, range) and CREATE DOMAIN', () => {
    expect(revert("CREATE TYPE app.status AS ENUM ('a');"))
      .toEqual({ sql: 'DROP TYPE app.status;', warnings: [] });
    expect(revert('CREATE TYPE app.pair AS (x int, y int);'))
      .toEqual({ sql: 'DROP TYPE app.pair;', warnings: [] });
    expect(revert('CREATE TYPE app.span AS RANGE (subtype = int4);'))
      .toEqual({ sql: 'DROP TYPE app.span;', warnings: [] });
    expect(revert('CREATE DOMAIN app.email AS text;'))
      .toEqual({ sql: 'DROP DOMAIN app.email;', warnings: [] });
  });

  it('inverts CREATE FUNCTION with the input signature (overload-safe)', () => {
    expect(revert('CREATE FUNCTION app.fn(a integer, b text[]) RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;'))
      .toEqual({ sql: 'DROP FUNCTION app.fn(int, text[]);', warnings: [] });
    expect(revert('CREATE FUNCTION app.fn() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;'))
      .toEqual({ sql: 'DROP FUNCTION app.fn();', warnings: [] });
  });

  it('excludes OUT and TABLE parameters from the drop signature', () => {
    expect(revert('CREATE FUNCTION app.fn(a int, OUT b int) RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;'))
      .toEqual({ sql: 'DROP FUNCTION app.fn(int);', warnings: [] });
  });

  it('inverts CREATE PROCEDURE as DROP PROCEDURE', () => {
    expect(revert('CREATE PROCEDURE app.proc(a int) LANGUAGE sql AS $$ SELECT 1 $$;'))
      .toEqual({ sql: 'DROP PROCEDURE app.proc(int);', warnings: [] });
  });

  it('inverts CREATE TRIGGER scoped to its table', () => {
    expect(revert('CREATE TRIGGER trg BEFORE INSERT ON app.users FOR EACH ROW EXECUTE FUNCTION app.fn();'))
      .toEqual({ sql: 'DROP TRIGGER trg ON app.users;', warnings: [] });
  });

  it('inverts CREATE POLICY scoped to its table', () => {
    expect(revert('CREATE POLICY p ON app.users USING (true);'))
      .toEqual({ sql: 'DROP POLICY p ON app.users;', warnings: [] });
  });

  it('inverts CREATE EXTENSION and CREATE ROLE', () => {
    expect(revert('CREATE EXTENSION IF NOT EXISTS pgcrypto;'))
      .toEqual({ sql: 'DROP EXTENSION pgcrypto;', warnings: [] });
    expect(revert('CREATE ROLE reader;')).toEqual({ sql: 'DROP ROLE reader;', warnings: [] });
  });

  it('inverts ALTER TABLE ADD COLUMN as DROP COLUMN', () => {
    expect(revert('ALTER TABLE app.users ADD COLUMN age int;'))
      .toEqual({ sql: 'ALTER TABLE app.users \n  DROP COLUMN age RESTRICT;', warnings: [] });
  });

  it('inverts ALTER TABLE ADD CONSTRAINT as DROP CONSTRAINT', () => {
    expect(revert('ALTER TABLE app.users ADD CONSTRAINT users_age_ck CHECK (age > 0);'))
      .toEqual({ sql: 'ALTER TABLE app.users \n  DROP CONSTRAINT users_age_ck RESTRICT;', warnings: [] });
  });

  it('warns on unnamed constraints instead of guessing the assigned name', () => {
    const result = revert('ALTER TABLE app.users ADD CHECK (age > 0);');
    expect(result.sql).toContain('-- revert not derivable: unnamed constraint on app.users');
    expect(result.warnings).toHaveLength(1);
  });

  it('inverts ENABLE/FORCE ROW LEVEL SECURITY', () => {
    expect(revert('ALTER TABLE app.users ENABLE ROW LEVEL SECURITY;'))
      .toEqual({ sql: 'ALTER TABLE app.users \n  DISABLE ROW LEVEL SECURITY;', warnings: [] });
    expect(revert('ALTER TABLE app.users FORCE ROW LEVEL SECURITY;'))
      .toEqual({ sql: 'ALTER TABLE app.users \n  NO FORCE ROW LEVEL SECURITY;', warnings: [] });
  });

  it('inverts multi-command ALTER TABLE in reverse command order', () => {
    const result = revert('ALTER TABLE app.users ADD COLUMN age int, ADD CONSTRAINT age_ck CHECK (age > 0);');
    expect(result.sql).toEqual(
      'ALTER TABLE app.users \n  DROP CONSTRAINT age_ck RESTRICT;\n\n' +
      'ALTER TABLE app.users \n  DROP COLUMN age RESTRICT;'
    );
    expect(result.warnings).toEqual([]);
  });

  it('inverts GRANT as REVOKE with the same privileges, objects, and roles', () => {
    expect(revert('GRANT SELECT, INSERT ON app.users TO reader;').sql)
      .toEqual('REVOKE SELECT, INSERT ON app.users FROM reader RESTRICT;');
    expect(revert('GRANT EXECUTE ON FUNCTION app.fn(int) TO reader;').sql)
      .toEqual('REVOKE EXECUTE ON FUNCTION app.fn(int) FROM reader RESTRICT;');
    expect(revert('GRANT USAGE ON SCHEMA app TO reader;').sql)
      .toEqual('REVOKE USAGE ON SCHEMA app FROM reader RESTRICT;');
  });

  it('inverts GRANT role TO role', () => {
    expect(revert('GRANT reader TO alice;').sql).toEqual('REVOKE READER FROM alice;');
  });

  it('does not invert REVOKE (prior grants unknown)', () => {
    const result = revert('REVOKE SELECT ON app.users FROM reader;');
    expect(result.sql).toEqual('-- revert not derivable: REVOKE has no mechanical inverse (prior grants unknown)');
    expect(result.warnings).toHaveLength(1);
  });

  it('inverts COMMENT ON as COMMENT ... IS NULL', () => {
    expect(revert("COMMENT ON TABLE app.users IS 'the users';"))
      .toEqual({ sql: 'COMMENT ON TABLE app.users IS NULL;', warnings: [] });
    expect(revert("COMMENT ON COLUMN app.users.id IS 'pk';"))
      .toEqual({ sql: 'COMMENT ON COLUMN app.users.id IS NULL;', warnings: [] });
  });

  it('never guesses for DML', () => {
    const result = revert("INSERT INTO app.users (id) VALUES (1);");
    expect(result.sql).toEqual('-- revert not derivable: DML is not mechanically invertible');
    expect(result.warnings).toEqual(['revert not derivable: DML is not mechanically invertible']);
  });

  it('never guesses for statements with no known inverse', () => {
    const result = revert('ALTER FUNCTION app.fn(int) SET search_path = app;');
    expect(result.sql).toContain('-- revert not derivable:');
    expect(result.warnings).toHaveLength(1);
  });

  it('warns instead of using CASCADE for ALTER ... SET (prior value unknown)', () => {
    const result = revert("ALTER TABLE app.users ALTER COLUMN id SET DEFAULT 0;");
    expect(result.sql).toContain('-- revert not derivable: ALTER TABLE app.users AT_ColumnDefault');
    expect(result.warnings).toHaveLength(1);
  });

  it('emits drops in reverse topological order of the statement graph', () => {
    const result = revert([
      'CREATE SCHEMA app;',
      'CREATE TABLE app.users (id int PRIMARY KEY);',
      'CREATE TABLE app.posts (id int PRIMARY KEY, user_id int REFERENCES app.users (id));',
      'CREATE VIEW app.v_posts AS SELECT id FROM app.posts;'
    ].join('\n'));
    expect(result.sql).toEqual([
      'DROP VIEW app.v_posts;',
      'DROP TABLE app.posts;',
      'DROP TABLE app.users;',
      'DROP SCHEMA app;'
    ].join('\n\n'));
    expect(result.warnings).toEqual([]);
    expect(result.sql).not.toContain('CASCADE');
  });

  it('drops dependents first even when the deploy script is unordered', () => {
    const result = revert([
      'CREATE VIEW app.v_users AS SELECT id FROM app.users;',
      'CREATE TABLE app.users (id int);'
    ].join('\n'));
    expect(result.sql).toEqual('DROP VIEW app.v_users;\n\nDROP TABLE app.users;');
  });
});

describe('verifyFor', () => {
  it('checks schemas via information_schema', () => {
    expect(verify('CREATE SCHEMA app;')).toEqual({
      sql: "SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'app') THEN 1 ELSE 0 END);",
      warnings: []
    });
  });

  it('checks relations via to_regclass', () => {
    expect(verify('CREATE TABLE app.users (id int);').sql)
      .toEqual("SELECT 1/(CASE WHEN to_regclass('app.users') IS NOT NULL THEN 1 ELSE 0 END);");
    expect(verify('CREATE VIEW app.v AS SELECT 1;').sql)
      .toEqual("SELECT 1/(CASE WHEN to_regclass('app.v') IS NOT NULL THEN 1 ELSE 0 END);");
    expect(verify('CREATE SEQUENCE app.seq;').sql)
      .toEqual("SELECT 1/(CASE WHEN to_regclass('app.seq') IS NOT NULL THEN 1 ELSE 0 END);");
    expect(verify('CREATE INDEX users_email_idx ON app.users (email);').sql)
      .toEqual("SELECT 1/(CASE WHEN to_regclass('app.users_email_idx') IS NOT NULL THEN 1 ELSE 0 END);");
  });

  it('checks types and domains via to_regtype', () => {
    expect(verify("CREATE TYPE app.status AS ENUM ('a');").sql)
      .toEqual("SELECT 1/(CASE WHEN to_regtype('app.status') IS NOT NULL THEN 1 ELSE 0 END);");
    expect(verify('CREATE TYPE app.pair AS (x int, y int);').sql)
      .toEqual("SELECT 1/(CASE WHEN to_regtype('app.pair') IS NOT NULL THEN 1 ELSE 0 END);");
    expect(verify('CREATE DOMAIN app.email AS text;').sql)
      .toEqual("SELECT 1/(CASE WHEN to_regtype('app.email') IS NOT NULL THEN 1 ELSE 0 END);");
  });

  it('checks functions via to_regprocedure with the input signature', () => {
    expect(verify('CREATE FUNCTION app.fn(a integer, b text[]) RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;').sql)
      .toEqual("SELECT 1/(CASE WHEN to_regprocedure('app.fn(int, text[])') IS NOT NULL THEN 1 ELSE 0 END);");
  });

  it('checks triggers via pg_trigger', () => {
    expect(verify('CREATE TRIGGER trg BEFORE INSERT ON app.users FOR EACH ROW EXECUTE FUNCTION app.fn();').sql)
      .toEqual(
        "SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg' " +
        "AND tgrelid = 'app.users'::regclass AND NOT tgisinternal) THEN 1 ELSE 0 END);"
      );
  });

  it('checks policies via pg_policies', () => {
    expect(verify('CREATE POLICY p ON app.users USING (true);').sql)
      .toEqual(
        "SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'p' " +
        "AND tablename = 'users' AND schemaname = 'app') THEN 1 ELSE 0 END);"
      );
  });

  it('checks extensions and roles via their catalogs', () => {
    expect(verify('CREATE EXTENSION pgcrypto;').sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN 1 ELSE 0 END);");
    expect(verify('CREATE ROLE reader;').sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reader') THEN 1 ELSE 0 END);");
  });

  it('checks added columns via information_schema.columns', () => {
    expect(verify('ALTER TABLE app.users ADD COLUMN age int;').sql)
      .toEqual(
        "SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE " +
        "table_name = 'users' AND column_name = 'age' AND table_schema = 'app') THEN 1 ELSE 0 END);"
      );
  });

  it('checks added constraints via information_schema.table_constraints', () => {
    expect(verify('ALTER TABLE app.users ADD CONSTRAINT age_ck CHECK (age > 0);').sql)
      .toEqual(
        "SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE " +
        "table_name = 'users' AND constraint_name = 'age_ck' AND table_schema = 'app') THEN 1 ELSE 0 END);"
      );
  });

  it('warns on unnamed constraints instead of guessing', () => {
    const result = verify('ALTER TABLE app.users ADD CHECK (age > 0);');
    expect(result.sql).toEqual('');
    expect(result.warnings).toHaveLength(1);
  });

  it('checks RLS via pg_class.relrowsecurity', () => {
    expect(verify('ALTER TABLE app.users ENABLE ROW LEVEL SECURITY;').sql)
      .toEqual(
        "SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace " +
        "WHERE c.relname = 'users' AND n.nspname = 'app' AND c.relrowsecurity) THEN 1 ELSE 0 END);"
      );
    expect(verify('ALTER TABLE app.users FORCE ROW LEVEL SECURITY;').sql)
      .toContain('c.relforcerowsecurity');
  });

  it('checks table grants via has_table_privilege, one per privilege', () => {
    expect(verify('GRANT SELECT, INSERT ON app.users TO reader;').sql).toEqual([
      "SELECT 1/(CASE WHEN has_table_privilege('reader', 'app.users', 'SELECT') THEN 1 ELSE 0 END);",
      "SELECT 1/(CASE WHEN has_table_privilege('reader', 'app.users', 'INSERT') THEN 1 ELSE 0 END);"
    ].join('\n\n'));
  });

  it('checks function grants via has_function_privilege', () => {
    expect(verify('GRANT EXECUTE ON FUNCTION app.fn(int) TO reader;').sql)
      .toEqual("SELECT 1/(CASE WHEN has_function_privilege('reader', 'app.fn(int)', 'EXECUTE') THEN 1 ELSE 0 END);");
  });

  it('checks schema grants via has_schema_privilege, including PUBLIC', () => {
    expect(verify('GRANT USAGE ON SCHEMA app TO reader;').sql)
      .toEqual("SELECT 1/(CASE WHEN has_schema_privilege('reader', 'app', 'USAGE') THEN 1 ELSE 0 END);");
    expect(verify('GRANT USAGE ON SCHEMA app TO PUBLIC;').sql)
      .toEqual("SELECT 1/(CASE WHEN has_schema_privilege('public', 'app', 'USAGE') THEN 1 ELSE 0 END);");
  });

  it('checks role membership grants via pg_auth_members', () => {
    expect(verify('GRANT reader TO alice;').sql)
      .toEqual(
        "SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_auth_members m " +
        "JOIN pg_roles granted ON granted.oid = m.roleid " +
        "JOIN pg_roles member ON member.oid = m.member " +
        "WHERE granted.rolname = 'reader' AND member.rolname = 'alice') THEN 1 ELSE 0 END);"
      );
  });

  it('warns on GRANT ALL rather than expanding it', () => {
    const result = verify('GRANT ALL ON app.users TO reader;');
    expect(result.sql).toEqual('');
    expect(result.warnings).toHaveLength(1);
  });

  it('emits nothing for comments and seed DML', () => {
    expect(verify("COMMENT ON TABLE app.users IS 'x';")).toEqual({ sql: '', warnings: [] });
    expect(verify("INSERT INTO app.users (id) VALUES (1);")).toEqual({ sql: '', warnings: [] });
  });

  it('quotes identifiers and escapes literals in generated checks', () => {
    expect(verify('CREATE TABLE "App"."Order Items" (id int);').sql)
      .toEqual(`SELECT 1/(CASE WHEN to_regclass('"App"."Order Items"') IS NOT NULL THEN 1 ELSE 0 END);`);
  });

  it('covers a full script with one check per statement in source order', () => {
    const result = verify([
      'CREATE SCHEMA app;',
      'CREATE TABLE app.users (id int);',
      'GRANT SELECT ON app.users TO reader;'
    ].join('\n'));
    expect(result.sql.split('\n\n')).toHaveLength(3);
    expect(result.warnings).toEqual([]);
  });
});
