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

describe('revertFor — extended vocabulary', () => {
  it('drops materialized views and CREATE TABLE AS tables', () => {
    expect(revert('CREATE MATERIALIZED VIEW app.mv AS SELECT 1 AS x;'))
      .toEqual({ sql: 'DROP MATERIALIZED VIEW app.mv;', warnings: [] });
    expect(revert('CREATE TABLE app.t2 AS SELECT 1 AS x;'))
      .toEqual({ sql: 'DROP TABLE app.t2;', warnings: [] });
  });

  it('drops foreign servers, foreign tables and user mappings', () => {
    expect(revert("CREATE SERVER films_server FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host 'h');"))
      .toEqual({ sql: 'DROP SERVER films_server;', warnings: [] });
    expect(revert('CREATE FOREIGN TABLE app.ft (id int) SERVER films_server;'))
      .toEqual({ sql: 'DROP FOREIGN TABLE app.ft;', warnings: [] });
    expect(revert("CREATE USER MAPPING FOR bob SERVER films_server OPTIONS (user 'bob');"))
      .toEqual({ sql: 'DROP USER MAPPING FOR bob SERVER films_server;', warnings: [] });
  });

  it('drops collations, aggregates (with signature) and binary operators', () => {
    expect(revert("CREATE COLLATION app.mycoll (locale = 'en_US.utf8');"))
      .toEqual({ sql: 'DROP COLLATION app.mycoll;', warnings: [] });
    expect(revert('CREATE AGGREGATE app.myagg (int) (sfunc = int4pl, stype = int);'))
      .toEqual({ sql: 'DROP AGGREGATE app.myagg(int);', warnings: [] });
    expect(revert('CREATE OPERATOR app.=== (LEFTARG = int, RIGHTARG = int, FUNCTION = int4eq);'))
      .toEqual({ sql: 'DROP OPERATOR app.===(int, int);', warnings: [] });
  });

  it('drops casts by source and target type', () => {
    expect(revert('CREATE CAST (int AS text) WITH INOUT AS IMPLICIT;'))
      .toEqual({ sql: 'DROP CAST (int AS text);', warnings: [] });
  });

  it('drops publications, subscriptions, statistics, event triggers and rules', () => {
    expect(revert('CREATE PUBLICATION mypub FOR TABLE app.users;'))
      .toEqual({ sql: 'DROP PUBLICATION mypub;', warnings: [] });
    expect(revert("CREATE SUBSCRIPTION mysub CONNECTION 'dbname=x' PUBLICATION mypub;"))
      .toEqual({ sql: 'DROP SUBSCRIPTION mysub RESTRICT;', warnings: [] });
    expect(revert('CREATE STATISTICS app.mystats (dependencies) ON a, b FROM app.users;'))
      .toEqual({ sql: 'DROP STATISTICS app.mystats;', warnings: [] });
    expect(revert('CREATE EVENT TRIGGER etrig ON ddl_command_end EXECUTE FUNCTION f();'))
      .toEqual({ sql: 'DROP EVENT TRIGGER etrig;', warnings: [] });
    expect(revert('CREATE RULE myrule AS ON DELETE TO app.users DO INSTEAD NOTHING;'))
      .toEqual({ sql: 'DROP RULE myrule ON app.users;', warnings: [] });
  });

  it('detaches attached partitions', () => {
    const result = revert('ALTER TABLE app.parted ATTACH PARTITION app.p1 FOR VALUES FROM (1) TO (10);');
    expect(result.sql).toEqual('ALTER TABLE app.parted \n  DETACH PARTITION app.p1;');
    expect(result.warnings).toEqual([]);
  });

  it('inverts ALTER DEFAULT PRIVILEGES GRANT to REVOKE', () => {
    const result = revert('ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO bob;');
    expect(result.sql).toEqual('ALTER DEFAULT PRIVILEGES IN SCHEMA app\n  REVOKE SELECT ON TABLES FROM bob RESTRICT;');
    expect(result.warnings).toEqual([]);
  });

  it('nulls security labels', () => {
    expect(revert("SECURITY LABEL FOR selinux ON TABLE app.users IS 'system_u';"))
      .toEqual({ sql: 'SECURITY LABEL FOR selinux ON TABLE app.users IS NULL;', warnings: [] });
  });

  it('warns for enum ADD VALUE (Postgres has no DROP VALUE)', () => {
    const result = revert("ALTER TYPE app.mood ADD VALUE 'sad';");
    expect(result.sql).toContain('-- revert not derivable:');
    expect(result.warnings).toHaveLength(1);
  });

  it('warns for prefix operators and non-grant default privileges', () => {
    const prefix = revert('CREATE OPERATOR app.!! (RIGHTARG = int, FUNCTION = int4um);');
    expect(prefix.warnings).toEqual(['revert not derivable: prefix operators are not supported (binary LEFTARG/RIGHTARG required)']);
    const revoke = revert('ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE SELECT ON TABLES FROM bob;');
    expect(revoke.warnings).toHaveLength(1);
  });
});

describe('verifyFor — extended vocabulary', () => {
  it('checks matviews, CTAS tables and foreign tables via to_regclass', () => {
    expect(verify('CREATE MATERIALIZED VIEW app.mv AS SELECT 1 AS x;').sql)
      .toEqual("SELECT 1/(CASE WHEN to_regclass('app.mv') IS NOT NULL THEN 1 ELSE 0 END);");
    expect(verify('CREATE FOREIGN TABLE app.ft (id int) SERVER films_server;').sql)
      .toEqual("SELECT 1/(CASE WHEN to_regclass('app.ft') IS NOT NULL THEN 1 ELSE 0 END);");
  });

  it('checks foreign servers and user mappings via catalogs', () => {
    expect(verify("CREATE SERVER films_server FOREIGN DATA WRAPPER postgres_fdw;").sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = 'films_server') THEN 1 ELSE 0 END);");
    expect(verify("CREATE USER MAPPING FOR bob SERVER films_server;").sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_user_mappings WHERE srvname = 'films_server' AND usename = 'bob') THEN 1 ELSE 0 END);");
  });

  it('checks collations, aggregates and operators', () => {
    expect(verify("CREATE COLLATION app.mycoll (locale = 'en_US.utf8');").sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_collation c JOIN pg_namespace n ON n.oid = c.collnamespace WHERE c.collname = 'mycoll' AND n.nspname = 'app') THEN 1 ELSE 0 END);");
    expect(verify('CREATE AGGREGATE app.myagg (int) (sfunc = int4pl, stype = int);').sql)
      .toEqual("SELECT 1/(CASE WHEN to_regprocedure('app.myagg(int)') IS NOT NULL THEN 1 ELSE 0 END);");
    expect(verify('CREATE OPERATOR app.=== (LEFTARG = int, RIGHTARG = int, FUNCTION = int4eq);').sql)
      .toEqual("SELECT 1/(CASE WHEN to_regoperator('app.===(int, int)') IS NOT NULL THEN 1 ELSE 0 END);");
  });

  it('checks casts via pg_cast', () => {
    expect(verify('CREATE CAST (int AS text) WITH INOUT AS IMPLICIT;').sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_cast WHERE castsource = 'int'::regtype AND casttarget = 'text'::regtype) THEN 1 ELSE 0 END);");
  });

  it('checks publications, subscriptions, statistics, event triggers and rules', () => {
    expect(verify('CREATE PUBLICATION mypub FOR TABLE app.users;').sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'mypub') THEN 1 ELSE 0 END);");
    expect(verify("CREATE SUBSCRIPTION mysub CONNECTION 'dbname=x' PUBLICATION mypub;").sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_subscription WHERE subname = 'mysub') THEN 1 ELSE 0 END);");
    expect(verify('CREATE STATISTICS app.mystats (dependencies) ON a, b FROM app.users;').sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_statistic_ext s JOIN pg_namespace n ON n.oid = s.stxnamespace WHERE s.stxname = 'mystats' AND n.nspname = 'app') THEN 1 ELSE 0 END);");
    expect(verify('CREATE EVENT TRIGGER etrig ON ddl_command_end EXECUTE FUNCTION f();').sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'etrig') THEN 1 ELSE 0 END);");
    expect(verify('CREATE RULE myrule AS ON DELETE TO app.users DO INSTEAD NOTHING;').sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_rules WHERE rulename = 'myrule' AND tablename = 'users' AND schemaname = 'app') THEN 1 ELSE 0 END);");
  });

  it('checks enum ADD VALUE labels via pg_enum', () => {
    expect(verify("ALTER TYPE app.mood ADD VALUE 'sad';").sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'app.mood'::regtype AND enumlabel = 'sad') THEN 1 ELSE 0 END);");
  });

  it('checks attached partitions via pg_inherits', () => {
    expect(verify('ALTER TABLE app.parted ATTACH PARTITION app.p1 FOR VALUES FROM (1) TO (10);').sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid = 'app.p1'::regclass AND inhparent = 'app.parted'::regclass) THEN 1 ELSE 0 END);");
  });

  it('checks default privileges via pg_default_acl + aclexplode', () => {
    expect(verify('ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO bob;').sql)
      .toEqual("SELECT 1/(CASE WHEN EXISTS (SELECT 1 FROM pg_default_acl d, aclexplode(d.defaclacl) a JOIN pg_roles r ON r.oid = a.grantee WHERE d.defaclobjtype = 'r' AND r.rolname = 'bob' AND a.privilege_type = 'SELECT' AND d.defaclnamespace IN (to_regnamespace('app'))) THEN 1 ELSE 0 END);");
  });

  it('emits nothing for security labels (metadata only)', () => {
    expect(verify("SECURITY LABEL FOR selinux ON TABLE app.users IS 'system_u';"))
      .toEqual({ sql: '', warnings: [] });
  });
});
