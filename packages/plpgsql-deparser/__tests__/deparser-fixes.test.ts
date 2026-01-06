import { loadModule, parsePlPgSQLSync } from '@libpg-query/parser';
import { deparseSync, PLpgSQLParseResult } from '../src';

describe('plpgsql-deparser bug fixes', () => {
  beforeAll(async () => {
    await loadModule();
  });

  describe('PERFORM SELECT fix', () => {
    it('should strip SELECT keyword from PERFORM statements', () => {
      const sql = `CREATE FUNCTION test_perform() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_sleep(1);
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('PERFORM pg_sleep');
      expect(deparsed).not.toMatch(/PERFORM\s+SELECT/i);
    });

    it('should handle PERFORM with complex expressions', () => {
      const sql = `CREATE FUNCTION test_perform_complex() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('search_path', 'public', true);
    PERFORM nextval('my_sequence');
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
      expect(deparsed).not.toMatch(/PERFORM\s+SELECT/i);
    });

    it('should handle PERFORM with subquery', () => {
      const sql = `CREATE FUNCTION test_perform_subquery() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM 1 FROM users WHERE id = 1;
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
      expect(deparsed).not.toMatch(/PERFORM\s+SELECT/i);
    });
  });

  describe('INTO clause depth-aware scanner', () => {
    it('should insert INTO at correct position for simple SELECT', () => {
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

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('INTO');
    });

    it('should not insert INTO inside subqueries', () => {
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

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
    });

    it('should handle INTO with CTE', () => {
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

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
    });

    it('should handle INTO with UNION', () => {
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

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
    });

    it('should handle INTO with quoted identifiers', () => {
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

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
    });

    it('should handle INTO with dollar-quoted strings', () => {
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

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
    });

    it('should handle INTO STRICT', () => {
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

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('STRICT');
    });
  });

  describe('Record field qualification (recfield)', () => {
    it('should qualify record fields with parent record name in triggers', () => {
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

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
    });

    it('should handle OLD and NEW record references', () => {
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

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
    });

    it('should handle record field assignment', () => {
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

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
    });

    it('should handle SELECT INTO with record fields', () => {
      const sql = `CREATE FUNCTION test_select_into_record() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT is_active INTO NEW.is_active FROM users WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
    });

    it('should handle custom record types', () => {
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

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
    });
  });

  describe('combined scenarios', () => {
    it('should handle PERFORM with record fields', () => {
      const sql = `CREATE FUNCTION test_perform_record() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM notify_change(NEW.id, NEW.status);
    RETURN NEW;
END;
$$`;

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
      expect(deparsed).not.toMatch(/PERFORM\s+SELECT/i);
    });

    it('should handle SELECT INTO with subquery and record fields', () => {
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

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);

      expect(deparsed).toMatchSnapshot();
    });
  });
});
