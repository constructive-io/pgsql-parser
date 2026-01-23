import { loadModule, parsePlPgSQLSync } from '@libpg-query/parser';
import { deparseSync, PLpgSQLParseResult } from '../src';
import { PLpgSQLTestUtils } from '../test-utils';

describe('plpgsql-deparser bug fixes', () => {
  let testUtils: PLpgSQLTestUtils;

  beforeAll(async () => {
    await loadModule();
    testUtils = new PLpgSQLTestUtils();
  });

  describe('PERFORM SELECT fix', () => {
    it('should strip SELECT keyword from PERFORM statements', async () => {
      const sql = `CREATE FUNCTION test_perform() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_sleep(1);
END;
$$`;

      // Round-trip test: parse -> deparse -> reparse -> compare ASTs
      await testUtils.expectAstMatch('PERFORM basic', sql);

      // Also verify specific output characteristics
      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('PERFORM pg_sleep');
      expect(deparsed).not.toMatch(/PERFORM\s+SELECT/i);
    });

    it('should handle PERFORM with complex expressions', async () => {
      const sql = `CREATE FUNCTION test_perform_complex() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('search_path', 'public', true);
    PERFORM nextval('my_sequence');
END;
$$`;

      await testUtils.expectAstMatch('PERFORM complex', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).not.toMatch(/PERFORM\s+SELECT/i);
    });

    it('should handle PERFORM with subquery', async () => {
      const sql = `CREATE FUNCTION test_perform_subquery() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM 1 FROM users WHERE id = 1;
END;
$$`;

      await testUtils.expectAstMatch('PERFORM subquery', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).not.toMatch(/PERFORM\s+SELECT/i);
    });
  });

  describe('INTO clause depth-aware scanner', () => {
    it('should insert INTO at correct position for simple SELECT', async () => {
      const sql = `CREATE FUNCTION test_into_simple() RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT count(*) INTO v_count FROM users;
    RETURN v_count;
END;
$$`;

      await testUtils.expectAstMatch('INTO simple', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('INTO');
    });

    it('should not insert INTO inside subqueries', async () => {
      const sql = `CREATE FUNCTION test_into_subquery() RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_result integer;
BEGIN
    SELECT (SELECT max(id) FROM orders) INTO v_result FROM users WHERE id = 1;
    RETURN v_result;
END;
$$`;

      await testUtils.expectAstMatch('INTO subquery', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle INTO with CTE', async () => {
      const sql = `CREATE FUNCTION test_into_cte() RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_total integer;
BEGIN
    WITH totals AS (
        SELECT sum(amount) as total FROM orders
    )
    SELECT total INTO v_total FROM totals;
    RETURN v_total;
END;
$$`;

      await testUtils.expectAstMatch('INTO CTE', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle INTO with UNION', async () => {
      const sql = `CREATE FUNCTION test_into_union() RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT count(*) INTO v_count FROM (
        SELECT id FROM users
        UNION ALL
        SELECT id FROM admins
    ) combined;
    RETURN v_count;
END;
$$`;

      await testUtils.expectAstMatch('INTO UNION', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle INTO with quoted identifiers', async () => {
      const sql = `CREATE FUNCTION test_into_quoted() RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_name text;
BEGIN
    SELECT "user-name" INTO v_name FROM "my-schema"."user-table" WHERE id = 1;
    RETURN v_name;
END;
$$`;

      await testUtils.expectAstMatch('INTO quoted', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle INTO with dollar-quoted strings', async () => {
      const sql = `CREATE FUNCTION test_into_dollar_quote() RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_result text;
BEGIN
    SELECT $tag$some FROM text$tag$ INTO v_result FROM dual;
    RETURN v_result;
END;
$$`;

      await testUtils.expectAstMatch('INTO dollar-quote', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle INTO STRICT', async () => {
      const sql = `CREATE FUNCTION test_into_strict() RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_id integer;
BEGIN
    SELECT id INTO STRICT v_id FROM users WHERE email = 'test@example.com';
    RETURN v_id;
END;
$$`;

      await testUtils.expectAstMatch('INTO STRICT', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('STRICT');
    });
  });

  describe('Record field qualification (recfield)', () => {
    it('should qualify record fields with parent record name in triggers', async () => {
      const sql = `CREATE FUNCTION test_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_active THEN
        NEW.updated_at := now();
    END IF;
    RETURN NEW;
END;
$$`;

      await testUtils.expectAstMatch('recfield trigger', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle OLD and NEW record references', async () => {
      const sql = `CREATE FUNCTION test_trigger_old_new() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO audit_log (old_status, new_status) VALUES (OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$`;

      await testUtils.expectAstMatch('recfield OLD NEW', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle record field assignment', async () => {
      const sql = `CREATE FUNCTION test_record_assign() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.updated_at := now();
    NEW.version := COALESCE(OLD.version, 0) + 1;
    RETURN NEW;
END;
$$`;

      await testUtils.expectAstMatch('recfield assignment', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle SELECT INTO with record fields', async () => {
      const sql = `CREATE FUNCTION test_select_into_record() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT is_active INTO NEW.is_active FROM users WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$`;

      await testUtils.expectAstMatch('recfield SELECT INTO', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle custom record types', async () => {
      const sql = `CREATE FUNCTION test_custom_record() RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, name FROM users LOOP
        RAISE NOTICE 'User: % - %', r.id, r.name;
    END LOOP;
END;
$$`;

      await testUtils.expectAstMatch('recfield custom record', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });
  });

  describe('OUT parameters with SELECT INTO multiple variables', () => {
    it('should handle SELECT INTO multiple OUT parameters', async () => {
      const sql = `CREATE FUNCTION test_out_params_select_into(
  p_user_id uuid,
  OUT id uuid,
  OUT user_id uuid,
  OUT access_token text,
  OUT access_token_expires_at timestamptz,
  OUT is_verified boolean,
  OUT totp_enabled boolean
)
LANGUAGE plpgsql AS $$
DECLARE
  v_token_id uuid;
  v_plaintext_token text;
BEGIN
  v_plaintext_token := encode(gen_random_bytes(48), 'hex');
  v_token_id := uuid_generate_v5(uuid_ns_url(), v_plaintext_token);
  
  INSERT INTO tokens (id, user_id, access_token_hash)
  VALUES (v_token_id, p_user_id, digest(v_plaintext_token, 'sha256'));
  
  SELECT tkn.id, tkn.user_id, v_plaintext_token, tkn.access_token_expires_at, tkn.is_verified, tkn.totp_enabled
  INTO id, user_id, access_token, access_token_expires_at, is_verified, totp_enabled
  FROM tokens AS tkn
  WHERE tkn.id = v_token_id;
  
  RETURN;
END$$`;

      await testUtils.expectAstMatch('OUT params SELECT INTO', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      // Verify multiple INTO targets are present
      expect(deparsed).toMatch(/INTO\s+id\s*,\s*user_id\s*,\s*access_token/i);
    });

    it('should handle SELECT INTO STRICT with multiple OUT parameters', async () => {
      const sql = `CREATE FUNCTION test_out_params_strict(
  p_id uuid,
  OUT name text,
  OUT email text
)
LANGUAGE plpgsql AS $$
BEGIN
  SELECT u.name, u.email INTO STRICT name, email
  FROM users u
  WHERE u.id = p_id;
END$$`;

      await testUtils.expectAstMatch('OUT params STRICT', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('STRICT');
      // Verify multiple INTO targets are present
      expect(deparsed).toMatch(/INTO\s+STRICT\s+name\s*,\s*email/i);
    });
  });

  describe('combined scenarios', () => {
    it('should handle PERFORM with record fields', async () => {
      const sql = `CREATE FUNCTION test_perform_record() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM notify_change(NEW.id, NEW.status);
    RETURN NEW;
END;
$$`;

      await testUtils.expectAstMatch('combined PERFORM recfield', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).not.toMatch(/PERFORM\s+SELECT/i);
    });

    it('should handle SELECT INTO with subquery and record fields', async () => {
      const sql = `CREATE FUNCTION test_complex_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT count(*) INTO v_count FROM orders WHERE user_id = NEW.user_id;
    IF v_count > 100 THEN
        NEW.is_premium := true;
    END IF;
    RETURN NEW;
END;
$$`;

      await testUtils.expectAstMatch('combined INTO recfield', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });
  });
});
