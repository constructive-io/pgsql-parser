import * as fs from 'fs';
import * as path from 'path';
import { loadModule } from 'plpgsql-parser';

import {
  captureAstsFromSql,
  escapeRegexp,
  extractPgpmHeader,
  SchemaTransformPass,
  SchemaTransformResult,
  shouldTransformSchema,
  transformComments,
  transformJsonStringValues,
  transformNameList,
  transformSchemaName,
  transformSql,
  TransformSqlOptions,
  transformSqlStatement,
  transformVerifyCalls,
  validateNoUntransformedSchemas,
  validateRoundTrip,
} from '../src';

// Initialize the WASM module before any tests run
beforeAll(async () => {
  await loadModule();
});

/**
 * Helper: create a standard schema mapping for tests.
 * Maps hyphenated schema names to underscored equivalents.
 */
function makeMapping(...pairs: [string, string][]): Map<string, string> {
  return new Map(pairs);
}

/** Default mapping used by most tests */
const DEFAULT_MAPPING = makeMapping(
  ['my-schema', 'my_schema'],
  ['other-schema', 'other_schema']
);

function freshResult(): SchemaTransformResult {
  return {
    schemasFound: new Set(),
    schemasTransformed: new Map(),
    errors: [],
  };
}

// =============================================================================
// Unit tests for helper functions
// =============================================================================

describe('should_transform_schema', () => {
  it('returns true for schemas in the mapping', () => {
    expect(shouldTransformSchema('my-schema', DEFAULT_MAPPING)).toBe(true);
  });

  it('returns false for schemas not in the mapping', () => {
    expect(shouldTransformSchema('unknown', DEFAULT_MAPPING)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(shouldTransformSchema(undefined, DEFAULT_MAPPING)).toBe(false);
  });
});

describe('transform_schema_name', () => {
  it('transforms a mapped schema name', () => {
    expect(transformSchemaName('my-schema', DEFAULT_MAPPING)).toBe('my_schema');
  });

  it('returns the original for unmapped names', () => {
    expect(transformSchemaName('unknown', DEFAULT_MAPPING)).toBe('unknown');
  });

  it('returns undefined for undefined input', () => {
    expect(transformSchemaName(undefined, DEFAULT_MAPPING)).toBeUndefined();
  });
});

describe('transform_name_list', () => {
  it('transforms the first element when it is a mapped schema', () => {
    const names = [
      { String: { sval: 'my-schema' } },
      { String: { sval: 'my_func' } }
    ];
    const result = freshResult();
    transformNameList(names, DEFAULT_MAPPING, result);
    expect(names[0].String.sval).toBe('my_schema');
    expect(result.schemasTransformed.get('my-schema')).toBe('my_schema');
  });

  it('does not transform single-element lists (unqualified)', () => {
    const names = [{ String: { sval: 'my-schema' } }];
    const result = freshResult();
    transformNameList(names, DEFAULT_MAPPING, result);
    expect(names[0].String.sval).toBe('my-schema');
  });

  it('skips undefined or empty lists', () => {
    const result = freshResult();
    transformNameList(undefined, DEFAULT_MAPPING, result);
    transformNameList([], DEFAULT_MAPPING, result);
    expect(result.schemasTransformed.size).toBe(0);
  });
});

describe('escape_regexp', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegexp('my-schema.public')).toBe('my-schema\\.public');
  });
});

// =============================================================================
// Unit tests for regex-based transforms
// =============================================================================

describe('transform_comments', () => {
  it('transforms schema names in Deploy/requires comment headers', () => {
    const content = [
      '-- Deploy schemas/my-schema/tables/users/table',
      '-- requires: schemas/my-schema/schema',
      '-- requires: schemas/other-schema/tables/posts/table',
    ].join('\n');
    const result = freshResult();
    const out = transformComments(content, DEFAULT_MAPPING, result);
    expect(out).toContain('schemas/my_schema/tables/users/table');
    expect(out).toContain('schemas/my_schema/schema');
    expect(out).toContain('schemas/other_schema/tables/posts/table');
  });

  it('does not transform non-header comments', () => {
    const content = '-- This is a regular comment with schemas/my-schema/stuff';
    const result = freshResult();
    const out = transformComments(content, DEFAULT_MAPPING, result);
    expect(out).toBe(content);
  });
});

describe('transform_verify_calls', () => {
  it('transforms schema names inside verify_function calls', () => {
    const content = "SELECT verify_function('my-schema.do_something');";
    const result = freshResult();
    const out = transformVerifyCalls(content, DEFAULT_MAPPING, result);
    expect(out).toContain("verify_function('my_schema.do_something')");
  });

  it('transforms verify_table, verify_trigger, etc.', () => {
    const content = "SELECT verify_table('my-schema.users');";
    const result = freshResult();
    const out = transformVerifyCalls(content, DEFAULT_MAPPING, result);
    expect(out).toContain("verify_table('my_schema.users')");
  });

  it('transforms verify_schema with just the schema name', () => {
    const content = "SELECT verify_schema('my-schema');";
    const result = freshResult();
    const out = transformVerifyCalls(content, DEFAULT_MAPPING, result);
    expect(out).toContain("verify_schema('my_schema')");
  });
});

describe('transform_json_string_values', () => {
  it('transforms schema names in JSON value contexts', () => {
    const content = `'{"authenticate_schema":"my-schema"}'`;
    const result = freshResult();
    const out = transformJsonStringValues(content, DEFAULT_MAPPING, result);
    expect(out).toContain(':"my_schema"');
  });

  it('does not transform non-JSON contexts', () => {
    const content = 'SELECT "my-schema".users';
    const result = freshResult();
    const out = transformJsonStringValues(content, DEFAULT_MAPPING, result);
    expect(out).toBe(content);
  });
});

describe('extract_pgpm_header', () => {
  it('separates header from SQL body', () => {
    const content = [
      '-- Deploy schemas/my-schema/tables/users/table',
      '-- made with <3 @ constructive.io',
      '',
      '',
      'CREATE TABLE "my-schema".users (id uuid);'
    ].join('\n');
    const { header, body } = extractPgpmHeader(content);
    expect(header).toContain('-- Deploy');
    expect(header).toContain('-- made with');
    expect(body).toContain('CREATE TABLE');
    expect(body).not.toContain('-- Deploy');
  });

  it('lifts the psql \\echo extension guard into the header', () => {
    const content = [
      '\\echo Use "CREATE EXTENSION my-module" to load this file. \\quit',
      '',
      'CREATE TABLE "my-schema".users (id uuid);'
    ].join('\n');
    const { header, body } = extractPgpmHeader(content);
    expect(header).toContain('\\echo');
    expect(body).toContain('CREATE TABLE');
    expect(body).not.toContain('\\echo');
  });
});

describe('schema references in strings and parameter types', () => {
  it('transforms schema-qualified refs inside string constants', () => {
    const sql = `SELECT pg_advisory_xact_lock(hashtextextended('my-schema.some_fn', 0));`;
    const { sql: out } = transformSqlStatement(sql, DEFAULT_MAPPING);
    expect(out).toContain(`'my_schema.some_fn'`);
    expect(out).not.toContain('my-schema');
  });

  it('transforms schema-qualified refs inside COMMENT text', () => {
    const sql = `COMMENT ON TABLE "my-schema".users IS 'See my-schema.audit_log for history.';`;
    const { sql: out } = transformSqlStatement(sql, DEFAULT_MAPPING);
    expect(out).toContain('my_schema.audit_log');
    expect(out).not.toContain('my-schema');
  });

  it('does not rewrite hyphenated prose words that are not mapped schemas', () => {
    const sql = `COMMENT ON TABLE "my-schema".users IS 'An allow-list. When set, applies server-side.';`;
    const { sql: out } = transformSqlStatement(sql, DEFAULT_MAPPING);
    expect(out).toContain('allow-list. When');
    expect(out).toContain('server-side.');
  });

  it('transforms schema-qualified composite types in function parameters', () => {
    const sql = `CREATE FUNCTION f(IN obj "my-schema".my_type) RETURNS void AS $$ SELECT 1; $$ LANGUAGE sql;`;
    const { sql: out } = transformSqlStatement(sql, DEFAULT_MAPPING);
    expect(out).toContain('my_schema.my_type');
    expect(out).not.toContain('"my-schema".my_type');
  });

  it('transforms schema-qualified names in DROP statements', () => {
    const cases = [
      'DROP TABLE "my-schema".users;',
      'DROP INDEX "my-schema".users_idx;',
      'DROP TRIGGER my_tg ON "my-schema".users;',
      'DROP POLICY my_policy ON "my-schema".users;',
      'DROP FUNCTION "my-schema".my_fn();',
      'DROP TYPE "my-schema".my_type;',
      'DROP SCHEMA "my-schema";'
    ];
    for (const sql of cases) {
      const { sql: out } = transformSqlStatement(sql, DEFAULT_MAPPING);
      expect(out).toContain('my_schema');
      expect(out).not.toContain('my-schema');
    }
  });

  it('transforms schema-qualified refs inside LANGUAGE sql function bodies', () => {
    const sql = [
      'CREATE FUNCTION "my-schema".user_ids() RETURNS uuid[] AS $_PGFN_$',
      'SELECT array_agg(u.id)',
      'FROM "my-schema".users AS u',
      '$_PGFN_$ LANGUAGE sql STABLE;'
    ].join('\n');
    const { sql: out } = transformSqlStatement(sql, DEFAULT_MAPPING);
    expect(out).toContain('"my_schema".users');
    expect(out).not.toContain('my-schema');
  });

  it('transforms schema-qualified refs inside RAISE messages', () => {
    const sql = [
      'CREATE FUNCTION "my-schema".fail_fn() RETURNS void AS $$',
      'BEGIN',
      `  RAISE EXCEPTION 'missing secrets in my-schema.secrets: %', 'x';`,
      'END;',
      '$$ LANGUAGE plpgsql;'
    ].join('\n');
    const { sql: out } = transformSqlStatement(sql, DEFAULT_MAPPING);
    expect(out).toContain('my_schema.secrets');
    expect(out).not.toContain('my-schema');
  });
});

// =============================================================================
// Unit tests for validate_no_untransformed_schemas
// =============================================================================

describe('validate_no_untransformed_schemas', () => {
  it('does not throw when all schemas are transformed', () => {
    const content = 'SELECT * FROM "my_schema".users';
    expect(() => validateNoUntransformedSchemas(content, DEFAULT_MAPPING)).not.toThrow();
  });

  it('throws when a schema-qualified reference remains', () => {
    const content = 'SELECT * FROM "my-schema".users';
    expect(() => validateNoUntransformedSchemas(content, DEFAULT_MAPPING)).toThrow(
      /AST transformation incomplete/
    );
  });

  it('throws for standalone schema names in SQL contexts', () => {
    const content = 'GRANT USAGE ON SCHEMA "my-schema" TO app_user';
    expect(() => validateNoUntransformedSchemas(content, DEFAULT_MAPPING)).toThrow(
      /AST transformation incomplete/
    );
  });

  it('does not throw for empty mapping', () => {
    const content = 'SELECT * FROM "my-schema".users';
    expect(() => validateNoUntransformedSchemas(content, new Map())).not.toThrow();
  });
});

// =============================================================================
// SQL AST Visitor Tests — one test per node type
//
// Note: The deparser outputs unquoted identifiers when they are valid SQL
// identifiers (e.g., my_schema not "my_schema"). Hyphenated names require
// quoting ("my-schema") but underscored names do not.
// =============================================================================

describe('SQL AST visitors', () => {
  // --- Already-handled nodes (existing visitors) ---

  describe('RangeVar (table references)', () => {
    it('transforms schema in SELECT FROM', () => {
      const { sql } = transformSqlStatement(
        'SELECT * FROM "my-schema".users;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });

    it('transforms schema in INSERT INTO', () => {
      const { sql } = transformSqlStatement(
        'INSERT INTO "my-schema".users (id) VALUES (1);',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });

    it('transforms schema in CREATE TABLE', () => {
      const { sql } = transformSqlStatement(
        'CREATE TABLE "my-schema".users (id uuid PRIMARY KEY);',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });

    it('tracks the old name correctly in schemas_transformed', () => {
      const { result } = transformSqlStatement(
        'SELECT * FROM "my-schema".users;',
        DEFAULT_MAPPING
      );
      expect(result.schemasTransformed.get('my-schema')).toBe('my_schema');
    });
  });

  describe('CreateSchemaStmt', () => {
    it('transforms CREATE SCHEMA', () => {
      const { sql } = transformSqlStatement(
        'CREATE SCHEMA "my-schema";',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('FuncCall', () => {
    it('transforms schema-qualified function calls', () => {
      const { sql } = transformSqlStatement(
        'SELECT "my-schema".do_something();',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('TypeName', () => {
    it('transforms schema-qualified type casts', () => {
      const { sql } = transformSqlStatement(
        'SELECT NULL::"my-schema".my_type;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('ColumnRef', () => {
    it('transforms schema-qualified column references', () => {
      const { sql } = transformSqlStatement(
        'SELECT "my-schema".users.id FROM "my-schema".users;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('GrantStmt', () => {
    it('transforms GRANT USAGE ON SCHEMA', () => {
      const { sql } = transformSqlStatement(
        'GRANT USAGE ON SCHEMA "my-schema" TO app_user;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema');
      expect(sql).not.toContain('my-schema');
    });

    it('transforms REVOKE ON SCHEMA', () => {
      const { sql } = transformSqlStatement(
        'REVOKE ALL ON SCHEMA "my-schema" FROM PUBLIC;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('VariableSetStmt', () => {
    it('transforms SET search_path', () => {
      const { sql } = transformSqlStatement(
        'SET search_path TO "my-schema", public;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('AlterDefaultPrivilegesStmt', () => {
    it('transforms ALTER DEFAULT PRIVILEGES IN SCHEMA', () => {
      const { sql } = transformSqlStatement(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA "my-schema" GRANT SELECT ON TABLES TO app_user;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('DropStmt (DROP SCHEMA)', () => {
    it('transforms DROP SCHEMA', () => {
      const { sql } = transformSqlStatement(
        'DROP SCHEMA IF EXISTS "my-schema";',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('CreateFunctionStmt', () => {
    it('transforms schema-qualified function name in CREATE FUNCTION', () => {
      const { sql } = transformSqlStatement(
        `CREATE FUNCTION "my-schema".my_func() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;`,
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  // --- New node handlers ---

  describe('CreateTrigStmt', () => {
    it('transforms schema-qualified trigger function name and relation', () => {
      const { sql } = transformSqlStatement(
        'CREATE TRIGGER my_tg BEFORE INSERT ON "my-schema".users FOR EACH ROW EXECUTE PROCEDURE "other-schema".my_tg_func();',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).toContain('other_schema.');
      expect(sql).not.toContain('my-schema');
      expect(sql).not.toContain('other-schema');
    });

    it('transforms EXECUTE FUNCTION variant', () => {
      const { sql } = transformSqlStatement(
        'CREATE TRIGGER my_tg AFTER UPDATE ON "my-schema".posts FOR EACH ROW EXECUTE FUNCTION "my-schema".posts_update_tg();',
        DEFAULT_MAPPING
      );
      expect(sql).not.toContain('my-schema');
      expect(sql).toContain('my_schema.');
    });
  });

  describe('CommentStmt', () => {
    it('transforms COMMENT ON TABLE', () => {
      const { sql } = transformSqlStatement(
        `COMMENT ON TABLE "my-schema".users IS 'User accounts';`,
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });

    it('transforms COMMENT ON COLUMN', () => {
      const { sql } = transformSqlStatement(
        `COMMENT ON COLUMN "my-schema".users.email IS 'User email address';`,
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('CreateFunctionStmt with body references', () => {
    it('transforms schema references inside PL/pgSQL function body', () => {
      const sqlIn = `
CREATE FUNCTION "my-schema".lookup_user(id uuid)
RETURNS SETOF "my-schema".users AS $$
BEGIN
  RETURN QUERY SELECT * FROM "my-schema".users WHERE id = id;
END;
$$ LANGUAGE plpgsql STABLE;`;
      const { sql } = transformSqlStatement(sqlIn, DEFAULT_MAPPING);
      expect(sql).not.toContain('my-schema');
      // All references should be transformed
      const occurrences = (sql.match(/my_schema\./g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(2);
    });
  });

  describe('AlterObjectSchemaStmt', () => {
    it('transforms ALTER TABLE SET SCHEMA', () => {
      const { sql } = transformSqlStatement(
        'ALTER TABLE "my-schema".users SET SCHEMA "other-schema";',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).toContain('other_schema');
      expect(sql).not.toContain('my-schema');
      expect(sql).not.toContain('other-schema');
    });
  });

  // --- New node handlers (round 2) ---

  describe('ViewStmt', () => {
    it('transforms schema in CREATE VIEW', () => {
      const { sql } = transformSqlStatement(
        'CREATE VIEW "my-schema".active_users AS SELECT id FROM "my-schema".users;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.active_users');
      expect(sql).toContain('my_schema.users');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('AlterTableStmt', () => {
    it('transforms schema in ALTER TABLE ADD COLUMN', () => {
      const { sql } = transformSqlStatement(
        'ALTER TABLE "my-schema".users ADD COLUMN bio text;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('CreateSeqStmt', () => {
    it('transforms schema in CREATE SEQUENCE', () => {
      const { sql } = transformSqlStatement(
        'CREATE SEQUENCE "my-schema".users_id_seq;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('AlterSeqStmt', () => {
    it('transforms schema in ALTER SEQUENCE', () => {
      const { sql } = transformSqlStatement(
        'ALTER SEQUENCE "my-schema".users_id_seq RESTART WITH 1;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });

    it('transforms schema in ALTER SEQUENCE OWNED BY', () => {
      const { sql } = transformSqlStatement(
        'ALTER SEQUENCE "my-schema".users_id_seq OWNED BY "my-schema".users.id;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
      // Both the sequence name and the OWNED BY target should be transformed
      const occurrences = (sql.match(/my_schema\./g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(2);
    });
  });

  describe('CreatePolicyStmt', () => {
    it('transforms schema in CREATE POLICY', () => {
      const { sql } = transformSqlStatement(
        'CREATE POLICY sel_policy ON "my-schema".users FOR SELECT USING (true);',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('RuleStmt', () => {
    it('transforms schema in CREATE RULE', () => {
      const { sql } = transformSqlStatement(
        'CREATE RULE notify_insert AS ON INSERT TO "my-schema".users DO NOTHING;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('CopyStmt', () => {
    it('transforms schema in COPY (AST-level)', () => {
      // Note: the deparser changes STDOUT to STDIN, but the AST transformation
      // correctly transforms the schema name.
      const { sql } = transformSqlStatement(
        'COPY "my-schema".users TO STDOUT;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('ClusterStmt', () => {
    it('transforms schema in CLUSTER', () => {
      const { sql } = transformSqlStatement(
        'CLUSTER "my-schema".users USING users_pkey;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('VacuumRelation', () => {
    it('transforms schema in VACUUM', () => {
      const { sql } = transformSqlStatement(
        'VACUUM "my-schema".users;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });

    it('transforms schema in ANALYZE', () => {
      const { sql } = transformSqlStatement(
        'ANALYZE "my-schema".users;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  describe('RefreshMatViewStmt', () => {
    it('transforms schema in REFRESH MATERIALIZED VIEW (AST-level)', () => {
      // Note: the deparser has a bug where it drops the relation name,
      // but the AST transformation correctly transforms the schema name.
      const { result } = transformSqlStatement(
        'REFRESH MATERIALIZED VIEW "my-schema".user_stats;',
        DEFAULT_MAPPING
      );
      expect(result.schemasTransformed.get('my-schema')).toBe('my_schema');
    });
  });

  describe('CreateTableAsStmt', () => {
    it('transforms schema in CREATE MATERIALIZED VIEW', () => {
      const { sql } = transformSqlStatement(
        'CREATE MATERIALIZED VIEW "my-schema".user_stats AS SELECT count(*) FROM "my-schema".users;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).not.toContain('my-schema');
    });
  });

  // --- Multiple schemas in one statement ---

  describe('multiple schemas in one statement', () => {
    it('transforms multiple different schemas', () => {
      const { sql } = transformSqlStatement(
        'SELECT * FROM "my-schema".users u JOIN "other-schema".posts p ON u.id = p.user_id;',
        DEFAULT_MAPPING
      );
      expect(sql).toContain('my_schema.');
      expect(sql).toContain('other_schema.');
      expect(sql).not.toContain('my-schema');
      expect(sql).not.toContain('other-schema');
    });
  });
});

// =============================================================================
// Full transform_sql tests (with headers + regex passes)
// =============================================================================

describe('transform_sql (full pipeline)', () => {
  it('transforms a complete SQL file with header and body', () => {
    const input = [
      '-- Deploy schemas/my-schema/tables/users/table',
      '-- made with <3 @ constructive.io',
      '',
      '-- requires: schemas/my-schema/schema',
      '',
      '',
      'CREATE TABLE "my-schema".users (id uuid PRIMARY KEY);',
    ].join('\n');

    const { content } = transformSql(input, DEFAULT_MAPPING);
    expect(content).toContain('schemas/my_schema/tables/users/table');
    expect(content).toContain('schemas/my_schema/schema');
    expect(content).toContain('my_schema.');
    expect(content).not.toContain('my-schema');
  });

  it('does NOT transform verify calls or JSON values by default', () => {
    // Use a schema name that is NOT in the mapping so the validator won't fire.
    // This proves that transform_sql itself no longer includes the regex passes.
    const mapping = makeMapping(['other-schema', 'other_schema']);
    const input = [
      '-- Deploy schemas/other-schema/tables/users/table',
      '',
      '',
      "SELECT verify_table('my-schema.users');",
      "SELECT setup('{\"target_schema\":\"my-schema\"}');",
    ].join('\n');

    const { content } = transformSql(input, mapping);
    // verify calls and JSON values are opaque string literals — not transformed without a pre_pass
    expect(content).toContain("verify_table('my-schema.users')");
    expect(content).toContain(':"my-schema"');
  });

  it('transforms verify calls when passed as a pre_pass', () => {
    const input = [
      '-- Verify schemas/my-schema/tables/users/table',
      '',
      '',
      "SELECT verify_table('my-schema.users');",
    ].join('\n');

    const opts: TransformSqlOptions = {
      prePasses: [transformVerifyCalls],
    };
    const { content } = transformSql(input, DEFAULT_MAPPING, opts);
    expect(content).toContain("verify_table('my_schema.users')");
  });

  it('transforms JSON string values when passed as a pre_pass', () => {
    const input = [
      '-- Deploy schemas/my-schema/procedures/setup',
      '',
      '',
      `SELECT setup('{"target_schema":"my-schema"}');`,
    ].join('\n');

    const opts: TransformSqlOptions = {
      prePasses: [transformJsonStringValues],
    };
    const { content } = transformSql(input, DEFAULT_MAPPING, opts);
    expect(content).toContain(':"my_schema"');
    expect(content).not.toContain(':"my-schema"');
  });

  it('supports legacy signature with result as third arg', () => {
    const input = [
      '-- Deploy schemas/my-schema/tables/users/table',
      '',
      '',
      'CREATE TABLE "my-schema".users (id uuid PRIMARY KEY);',
    ].join('\n');

    const r = freshResult();
    const { content, result } = transformSql(input, DEFAULT_MAPPING, r);
    expect(content).toContain('my_schema.');
    expect(result).toBe(r);
    expect(result.schemasTransformed.get('my-schema')).toBe('my_schema');
  });

  it('runs post_passes after AST transformation', () => {
    const input = [
      '-- Deploy schemas/my-schema/tables/users/table',
      '',
      '',
      'CREATE TABLE "my-schema".users (id uuid PRIMARY KEY);',
    ].join('\n');

    const appendComment: SchemaTransformPass = (content) =>
      content + '\n-- post-pass was here';

    const opts: TransformSqlOptions = { postPasses: [appendComment] };
    const { content } = transformSql(input, DEFAULT_MAPPING, opts);
    expect(content).toContain('-- post-pass was here');
    expect(content).toContain('my_schema.');
  });

  it('chains multiple pre_passes in order', () => {
    const input = [
      '-- Deploy schemas/my-schema/tables/users/table',
      '',
      '',
      `INSERT INTO "my-schema".config (data) VALUES ('{"schema":"my-schema"}');`,
      "SELECT verify_table('my-schema.config');",
    ].join('\n');

    const opts: TransformSqlOptions = {
      prePasses: [transformVerifyCalls, transformJsonStringValues],
    };
    const { content } = transformSql(input, DEFAULT_MAPPING, opts);
    expect(content).toContain("verify_table('my_schema.config')");
    expect(content).toContain(':"my_schema"');
    expect(content).toContain('my_schema.config');
  });

  it('returns unchanged content when mapping is empty', () => {
    const input = 'SELECT * FROM "my-schema".users;';
    const { content } = transformSql(input, new Map());
    expect(content).toBe(input);
  });
});

// =============================================================================
// Edge cases and regression tests
// =============================================================================

describe('edge cases', () => {
  it('handles schemas without hyphens that are in the mapping', () => {
    const mapping = makeMapping(['old_schema', 'new_schema']);
    const { sql } = transformSqlStatement(
      'SELECT * FROM old_schema.users;',
      mapping
    );
    expect(sql).toContain('new_schema');
    expect(sql).not.toContain('old_schema');
  });

  it('does not transform schemas that are not in the mapping', () => {
    const { sql } = transformSqlStatement(
      'SELECT * FROM public.users;',
      DEFAULT_MAPPING
    );
    expect(sql).toContain('public');
  });

  it('handles empty mapping gracefully', () => {
    const { sql } = transformSqlStatement('SELECT 1;', new Map());
    expect(sql).toContain('SELECT');
  });
});

// =============================================================================
// Fixture-based golden tests
//
// Every .sql file in __fixtures__/input/ is auto-enumerated: transformed with
// the default mapping, asserted against the golden __fixtures__/output/<file>,
// checked for leftover hyphenated schema refs, determinism, and full AST
// round-trip validation (AST1 === AST2, incl. PL/pgSQL bodies).
//
// To add a new fixture: drop a .sql file in __fixtures__/input/ and run
// `pnpm fixtures` to generate its golden output.
// =============================================================================

const FIXTURES_DIR = path.resolve(__dirname, '..', '__fixtures__');
const FIXTURE_INPUT_DIR = path.join(FIXTURES_DIR, 'input');
const FIXTURE_OUTPUT_DIR = path.join(FIXTURES_DIR, 'output');
const FIXTURE_FILES = fs
  .readdirSync(FIXTURE_INPUT_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

describe.each(FIXTURE_FILES)('fixture: %s', (file) => {
  const FIXTURE_OPTS: TransformSqlOptions = {
    prePasses: [transformVerifyCalls, transformJsonStringValues],
  };
  const input = fs.readFileSync(path.join(FIXTURE_INPUT_DIR, file), 'utf8');

  it('transforms the input to match the golden output', () => {
    const expectedOutput = fs.readFileSync(
      path.join(FIXTURE_OUTPUT_DIR, file),
      'utf8'
    );
    const { content, result } = transformSql(input, DEFAULT_MAPPING, FIXTURE_OPTS);
    expect(content).toBe(expectedOutput);
    expect(result.errors).toEqual([]);
  });

  it('records the schema transformations it performed', () => {
    const { result } = transformSql(input, DEFAULT_MAPPING, FIXTURE_OPTS);
    for (const [schema, renamed] of result.schemasTransformed) {
      expect(renamed).toBe(DEFAULT_MAPPING.get(schema));
    }
    expect(result.schemasTransformed.size).toBeGreaterThan(0);
  });

  it('leaves no untransformed hyphenated schema names in the output', () => {
    const { content } = transformSql(input, DEFAULT_MAPPING, FIXTURE_OPTS);
    // Ignore comment lines, which may document the fixture purpose
    const sqlOnly = content
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    expect(sqlOnly).not.toContain('"my-schema"');
    expect(sqlOnly).not.toContain('"other-schema"');
    expect(sqlOnly).not.toMatch(/\bmy-schema\b/);
    expect(sqlOnly).not.toMatch(/\bother-schema\b/);
  });

  it('produces deterministic output on repeated transforms', () => {
    const first = transformSql(input, DEFAULT_MAPPING, FIXTURE_OPTS);
    const second = transformSql(input, DEFAULT_MAPPING, FIXTURE_OPTS);
    expect(first.content).toBe(second.content);
  });

  it('passes round-trip validation (AST1 === AST2)', () => {
    const { content } = transformSql(input, DEFAULT_MAPPING, {
      ...FIXTURE_OPTS,
      roundTrip: true,
    });
    expect(content.length).toBeGreaterThan(0);
  });
});

describe('kitchen-sink fixture', () => {
  it('finds both schemas', () => {
    const input = fs.readFileSync(
      path.join(FIXTURE_INPUT_DIR, 'kitchen-sink.sql'),
      'utf8'
    );
    const { result } = transformSql(input, DEFAULT_MAPPING, {
      prePasses: [transformVerifyCalls, transformJsonStringValues],
    });
    expect(result.schemasFound).toContain('my-schema');
    expect(result.schemasFound).toContain('other-schema');
  });
});

describe('plpgsql deparser round-trip regressions', () => {
  it('preserves INTO after DML RETURNING inside plpgsql functions', () => {
    const sql = `CREATE FUNCTION "my-schema".create_store() RETURNS uuid AS $$
DECLARE
  store_id uuid;
BEGIN
  INSERT INTO "my-schema".platform_infra_store (scope_id, name)
  VALUES ('028752cb-510b-1438-2f39-64534bd1cbd7'::uuid, 'infra')
  RETURNING id INTO store_id;
  RETURN store_id;
END;
$$ LANGUAGE plpgsql;`;

    const { sql: transformed } = transformSqlStatement(sql, DEFAULT_MAPPING);
    expect(transformed).toContain('my_schema.');
    expect(transformed).toMatch(/RETURNING\s+id\s+INTO\s+store_id/);
  });

  it('does not emit an implicit trailing RETURN in trigger functions', () => {
    const sql = `CREATE FUNCTION "my-schema".tg_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;`;

    const { sql: transformed } = transformSqlStatement(sql, DEFAULT_MAPPING);
    expect(transformed).toContain('my_schema.');
    expect(transformed).not.toMatch(/RETURN;/);
  });

  it('preserves explicit trailing RETURN in void functions', () => {
    const sql = `CREATE FUNCTION "my-schema".notify_only() RETURNS void AS $$
BEGIN
  RAISE NOTICE 'hi';
  RETURN;
END;
$$ LANGUAGE plpgsql;`;

    const { sql: transformed } = transformSqlStatement(sql, DEFAULT_MAPPING);
    expect(transformed).toMatch(/RETURN;/);
  });
});

describe('adversarial statement coverage', () => {
  const noLeftover = (sql: string) => {
    const { sql: out } = transformSqlStatement(sql, DEFAULT_MAPPING);
    expect(out).not.toMatch(/(?:"my-schema"|"other-schema"|\bmy-schema(?=\.)|\bother-schema(?=\.))/);
    return out;
  };

  it('transforms GRANT/REVOKE ... ON ALL ... IN SCHEMA', () => {
    noLeftover(`GRANT SELECT ON ALL TABLES IN SCHEMA "my-schema" TO PUBLIC;`);
    noLeftover(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "my-schema" TO app_user;`);
    noLeftover(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA "my-schema" FROM PUBLIC;`);
  });

  it('transforms ALTER ... SET SCHEMA for types and functions', () => {
    noLeftover(`ALTER TYPE "my-schema".ty SET SCHEMA "other-schema";`);
    noLeftover(`ALTER FUNCTION "my-schema".fn() SET SCHEMA "other-schema";`);
    noLeftover(`ALTER TABLE "my-schema".users SET SCHEMA "other-schema";`);
  });

  it('transforms ALTER SCHEMA ... RENAME TO and ALTER TABLE ... RENAME', () => {
    noLeftover(`ALTER SCHEMA "my-schema" RENAME TO renamed_schema;`);
    noLeftover(`ALTER TABLE "my-schema".users RENAME TO users2;`);
  });

  it('transforms COMMENT ON SCHEMA', () => {
    const out = noLeftover(`COMMENT ON SCHEMA "my-schema" IS 'the my-schema.stuff schema';`);
    expect(out).toContain('my_schema.stuff');
  });

  it('transforms ALTER FUNCTION ... SET search_path', () => {
    noLeftover(`ALTER FUNCTION "my-schema".f() SET search_path = "my-schema", public;`);
  });

  it('transforms DO block bodies', () => {
    const out = noLeftover(`DO $$
BEGIN
  PERFORM "my-schema".fn();
  INSERT INTO "my-schema".users (id) VALUES (1);
END;
$$;`);
    expect(out).toContain('my_schema');
  });

  it('transforms CREATE CAST types and functions', () => {
    noLeftover(`CREATE CAST ("my-schema".ty1 AS "my-schema".ty2) WITH FUNCTION "my-schema".cast_fn("my-schema".ty1);`);
  });

  it('transforms CREATE EVENT TRIGGER function references', () => {
    noLeftover(`CREATE EVENT TRIGGER my_evt ON ddl_command_end EXECUTE FUNCTION "my-schema".evt_fn();`);
  });

  it('transforms index opclass references', () => {
    noLeftover(`CREATE INDEX idx2 ON "my-schema".users USING gin (name "other-schema".my_opclass);`);
  });

  it('transforms SECURITY LABEL object references', () => {
    noLeftover(`SECURITY LABEL FOR anon ON COLUMN "my-schema".users.name IS 'MASKED WITH FUNCTION anon.fake_name()';`);
  });

  it('transforms statements inside plpgsql EXCEPTION handler bodies', () => {
    const out = noLeftover(`CREATE FUNCTION "my-schema".exf() RETURNS void AS $$
BEGIN
  NULL;
EXCEPTION WHEN OTHERS THEN
  PERFORM "my-schema".log_err();
END;
$$ LANGUAGE plpgsql;`);
    expect(out).toContain('my_schema.log_err');
  });

  it('preserves array bounds on schema-qualified DECLARE types', () => {
    const out = noLeftover(`CREATE FUNCTION "my-schema".arr_fn() RETURNS void AS $$
DECLARE
  items "my-schema".mytype[];
  item "my-schema".mytype;
  rows "my-schema".users%rowtype;
BEGIN
  items := array_fill(item, ARRAY[1]);
END;
$$ LANGUAGE plpgsql;`);
    expect(out).toContain('my_schema.mytype[];');
    expect(out).toContain('item my_schema.mytype;');
    expect(out).toMatch(/my_schema\.users%ROWTYPE/i);
  });

  it('transforms MERGE statements including when clauses', () => {
    const out = noLeftover(`MERGE INTO "my-schema".users u USING "other-schema".t s ON u.id = s.id WHEN MATCHED THEN UPDATE SET name = s.name WHEN NOT MATCHED THEN INSERT (id) VALUES (s.id);`);
    expect(out).toContain('MERGE INTO my_schema.users');
    expect(out).toContain('other_schema.t');
  });

  it('transforms qualified aggregates and operators', () => {
    noLeftover(`CREATE AGGREGATE "my-schema".agg2(int) (SFUNC = "my-schema".step_fn, STYPE = int);`);
    noLeftover(`CREATE OPERATOR "my-schema".=== (LEFTARG = int, RIGHTARG = int, FUNCTION = "my-schema".op_fn);`);
  });
});

// =============================================================================
// Generated PL/pgSQL construct coverage
//
// A scan of the generated corpus (application/, services/, pgpm-modules/;
// see scripts/scan-corpus.js) enumerated every PL/pgSQL statement node type we
// emit. Coverage for those constructs lives in the dedicated fixture
// (__fixtures__/input/plpgsql-constructs.sql: CASE, simple CASE, WHILE,
// bare LOOP + EXIT, FOREACH, CONTINUE, RETURN NEXT, EXCEPTION + GET STACKED
// DIAGNOSTICS), which the auto-enumerated fixture harness runs through the
// golden-output, no-leftover, determinism, and round-trip checks.
//
// This block only tracks a shape that CANNOT live in the golden fixture because
// it is silently corrupted upstream:
//
// KNOWN UPSTREAM LIMITATION (tracked, not a transform/deparser bug):
// libpg-query's PL/pgSQL parser emits `RETURN NEXT <expr>` as a bare node with
// no `expr`/`retvarno`, so the returned expression is dropped on deparse
// (`RETURN NEXT r` -> `RETURN NEXT`). Plain `RETURN <expr>` is unaffected. Our
// generated corpus only emits the bare OUT-parameter form (in the fixture), so
// generation is not affected. `it.failing` tracks the gap: this test will START
// failing (alerting us) if a future libpg-query build fixes the parser, at which
// point it should become a normal passing test.
// =============================================================================

describe('generated PL/pgSQL construct coverage', () => {
  // Deparser bug fixed upstream in pgsql-parser #306 (plpgsql-deparser 0.7.13)
  it('bound cursor keeps its explicit argument list', () => {
    const { content } = transformSql(
      `CREATE FUNCTION "my-schema".cur_args() RETURNS void AS $$
DECLARE
  c CURSOR (key int) FOR SELECT * FROM "my-schema".users WHERE id = key;
  r record;
BEGIN
  OPEN c(42);
  FETCH c INTO r;
  CLOSE c;
END;
$$ LANGUAGE plpgsql;`,
      DEFAULT_MAPPING,
      { roundTrip: true }
    );
    expect(content).toMatch(/c CURSOR \(key int\) FOR/);
  });

  // Deparser bug fixed upstream in pgsql-parser #306 (plpgsql-deparser 0.7.13)
  it('RAISE SQLSTATE keeps the SQLSTATE literal form', () => {
    const { content } = transformSql(
      `CREATE FUNCTION "my-schema".raise_state() RETURNS void AS $$
BEGIN
  RAISE SQLSTATE '22012';
END;
$$ LANGUAGE plpgsql;`,
      DEFAULT_MAPPING,
      { roundTrip: true }
    );
    expect(content).toMatch(/SQLSTATE '22012'/);
  });

  // Fixed upstream: libpg-query 18.1.2 serializes ALIAS declarations as an
  // `aliases` array on PLpgSQL_function ({name, varno, lineno}) and
  // plpgsql-deparser 18.1.2 re-emits `arg ALIAS FOR $1;` from that metadata.
  it('ALIAS FOR $1 declarations survive the round trip', () => {
    const { content } = transformSql(
      `CREATE FUNCTION "my-schema".alias_fn(int) RETURNS int AS $$
DECLARE
  arg ALIAS FOR $1;
BEGIN
  RETURN arg + 1;
END;
$$ LANGUAGE plpgsql;`,
      DEFAULT_MAPPING,
      { roundTrip: true }
    );
    expect(content).toMatch(/ALIAS FOR \$1/i);
  });

  // Fixed upstream: @libpg-query/parser 17.8.0 serializes retvarno and
  // plpgsql-deparser 0.8.0 emits the variable when it isn't an OUT parameter.
  it('RETURN NEXT <expr> preserves the returned expression', () => {
    const { content } = transformSql(
      `CREATE FUNCTION my_schema.rn_expr() RETURNS SETOF int AS $$
DECLARE
  r int;
BEGIN
  FOR r IN SELECT g FROM generate_series(1, 3) g LOOP
    RETURN NEXT r;
  END LOOP;
END;
$$ LANGUAGE plpgsql;`,
      makeMapping(['other-schema', 'other_schema'])
    );
    expect(content).toMatch(/RETURN NEXT r\b/);
  });
});

// =============================================================================
// Round-trip validation
// =============================================================================

describe('round-trip validation', () => {
  it('catches dropped array bounds in a DECLARE section', () => {
    const good = `CREATE FUNCTION my_schema.f() RETURNS void AS $$DECLARE x my_schema.users[]; BEGIN NULL; END;$$ LANGUAGE plpgsql;`;
    const bad = good.replace('users[]', 'users');
    const before = captureAstsFromSql(good);
    expect(() => validateRoundTrip(before, bad)).toThrow(
      /PL\/pgSQL AST mismatch/
    );
    expect(() => validateRoundTrip(before, good)).not.toThrow();
  });

  it('catches SQL-level corruption (changed identifier)', () => {
    const good = `CREATE TABLE my_schema.users (id int);`;
    const bad = `CREATE TABLE my_schema.user_z (id int);`;
    const before = captureAstsFromSql(good);
    expect(() => validateRoundTrip(before, bad)).toThrow(
      /SQL AST mismatch/
    );
  });

  it('catches a dropped statement', () => {
    const good = `CREATE TABLE my_schema.a (id int); CREATE TABLE my_schema.b (id int);`;
    const bad = `CREATE TABLE my_schema.a (id int);`;
    const before = captureAstsFromSql(good);
    expect(() => validateRoundTrip(before, bad)).toThrow(/round-trip/);
  });
});
