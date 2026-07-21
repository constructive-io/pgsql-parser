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

  // ===========================================================================
  // Group 1: Nested Block Compositions (END; bug class)
  // ===========================================================================
  describe('nested block compositions (END; bug class)', () => {
    it('should handle nested block followed by RETURN', async () => {
      const sql = `CREATE FUNCTION test_nested_block_return() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_result integer;
BEGIN
  BEGIN
    v_result := 1;
  END;
  RETURN v_result;
END$$`;

      await testUtils.expectAstMatch('nested block + RETURN', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('END;');
      expect(deparsed).toContain('RETURN');
    });

    it('should handle nested block followed by IF', async () => {
      const sql = `CREATE FUNCTION test_nested_block_if() RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM setup_something();
  END;
  IF FOUND THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END$$`;

      await testUtils.expectAstMatch('nested block + IF', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle nested block followed by RAISE', async () => {
      const sql = `CREATE FUNCTION test_nested_block_raise() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM risky_operation();
  END;
  RAISE NOTICE 'Operation completed';
  RETURN;
END$$`;

      await testUtils.expectAstMatch('nested block + RAISE', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle nested block followed by PERFORM', async () => {
      const sql = `CREATE FUNCTION test_nested_block_perform() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_count integer;
BEGIN
  BEGIN
    v_count := 42;
  END;
  PERFORM log_result(v_count);
  RETURN v_count;
END$$`;

      await testUtils.expectAstMatch('nested block + PERFORM', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle nested block followed by assignment', async () => {
      const sql = `CREATE FUNCTION test_nested_block_assign() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
BEGIN
  BEGIN
    PERFORM init();
  END;
  v_status := 'complete';
  RETURN v_status;
END$$`;

      await testUtils.expectAstMatch('nested block + assignment', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle labeled nested block', async () => {
      const sql = `CREATE FUNCTION test_labeled_nested_block() RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  <<inner>>
  BEGIN
    PERFORM do_work();
  END inner;
  RETURN TRUE;
END$$`;

      await testUtils.expectAstMatch('labeled nested block', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('<<inner>>');
      expect(deparsed).toMatch(/END\s+inner;/i);
    });
  });

  // ===========================================================================
  // Group 2: Blocks Inside Control Structures
  // ===========================================================================
  describe('blocks inside control structures', () => {
    it('should handle block inside IF THEN branch', async () => {
      const sql = `CREATE FUNCTION test_block_in_if() RETURNS integer
LANGUAGE plpgsql AS $$
BEGIN
  IF 1 > 0 THEN
    BEGIN
      PERFORM positive_handler();
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'error in positive handler';
    END;
  ELSE
    RETURN 0;
  END IF;
  RETURN 1;
END$$`;

      await testUtils.expectAstMatch('block in IF', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle block inside LOOP body', async () => {
      const sql = `CREATE FUNCTION test_block_in_loop() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  LOOP
    BEGIN
      PERFORM process_next();
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'skipping bad record';
    END;
    EXIT WHEN NOT FOUND;
  END LOOP;
  RETURN;
END$$`;

      await testUtils.expectAstMatch('block in LOOP', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle block inside CASE WHEN', async () => {
      const sql = `CREATE FUNCTION test_block_in_case(p_status text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  CASE p_status
    WHEN 'retry' THEN
      BEGIN
        PERFORM retry_operation();
      EXCEPTION
        WHEN others THEN
          RAISE EXCEPTION 'retry failed';
      END;
    WHEN 'skip' THEN
      RAISE NOTICE 'skipping';
  END CASE;
  RETURN;
END$$`;

      await testUtils.expectAstMatch('block in CASE', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });
  });

  // ===========================================================================
  // Group 3: Deep Nesting & Sequential Blocks
  // ===========================================================================
  describe('deep nesting and sequential blocks', () => {
    it('should handle two sequential nested blocks', async () => {
      const sql = `CREATE FUNCTION test_sequential_blocks() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM step_one();
  END;
  BEGIN
    PERFORM step_two();
  END;
  RETURN;
END$$`;

      await testUtils.expectAstMatch('sequential blocks', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle triple-nested blocks', async () => {
      const sql = `CREATE FUNCTION test_triple_nested() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    BEGIN
      PERFORM deep_call();
    END;
    RAISE NOTICE 'middle';
  END;
  RETURN;
END$$`;

      await testUtils.expectAstMatch('triple-nested blocks', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle block inside exception handler', async () => {
      const sql = `CREATE FUNCTION test_block_in_exception() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM risky();
EXCEPTION
  WHEN others THEN
    BEGIN
      PERFORM log_error();
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'even logging failed';
    END;
END$$`;

      await testUtils.expectAstMatch('block in exception handler', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });
  });

  // ===========================================================================
  // Group 4: Untested Statement Types
  // ===========================================================================
  describe('untested statement types', () => {
    it('should handle FOR integer loop', async () => {
      const sql = `CREATE FUNCTION test_for_integer_loop() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  FOR i IN 1..10 LOOP
    PERFORM process(i);
  END LOOP;
  RETURN;
END$$`;

      await testUtils.expectAstMatch('FOR integer loop', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle FOR query loop', async () => {
      const sql = `CREATE FUNCTION test_for_query_loop() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT id, name FROM my_table LOOP
    PERFORM handle(rec);
  END LOOP;
  RETURN;
END$$`;

      await testUtils.expectAstMatch('FOR query loop', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });

    it('should handle labeled FOR loop with EXIT', async () => {
      const sql = `CREATE FUNCTION test_labeled_for_loop() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  rec record;
BEGIN
  <<row_loop>>
  FOR rec IN SELECT id, name FROM items LOOP
    EXIT row_loop WHEN rec.id IS NULL;
    PERFORM process(rec);
  END LOOP row_loop;
  RETURN;
END$$`;

      await testUtils.expectAstMatch('labeled FOR loop', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('<<row_loop>>');
    });

    it('should handle RETURN NEXT with OUT parameters', async () => {
      const sql = `CREATE FUNCTION test_return_next_out(OUT x integer, OUT y text) RETURNS SETOF record
LANGUAGE plpgsql AS $$
BEGIN
  FOR i IN 1..5 LOOP
    x := i;
    y := 'item_' || i::text;
    RETURN NEXT;
  END LOOP;
  RETURN;
END$$`;

      await testUtils.expectAstMatch('RETURN NEXT', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('RETURN NEXT');
    });

    it('should handle RETURN QUERY', async () => {
      const sql = `CREATE FUNCTION test_return_query_simple() RETURNS SETOF record
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY SELECT id, name FROM my_table WHERE active = TRUE;
END$$`;

      await testUtils.expectAstMatch('RETURN QUERY', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('RETURN QUERY');
    });

    it('should handle ASSERT statement', async () => {
      const sql = `CREATE FUNCTION test_assert(p_x integer) RETURNS integer
LANGUAGE plpgsql AS $$
BEGIN
  ASSERT p_x > 0, 'x must be positive';
  RETURN p_x;
END$$`;

      await testUtils.expectAstMatch('ASSERT', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('ASSERT');
    });

    it('should handle CALL statement', async () => {
      const sql = `CREATE FUNCTION test_call_statement() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  CALL my_procedure(1, 'hello');
  RETURN;
END$$`;

      await testUtils.expectAstMatch('CALL statement', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('CALL');
    });
  });

  // ===========================================================================
  // Group 5: Real-World Patterns
  // ===========================================================================
  describe('real-world patterns', () => {
    it('should handle permission bitnum trigger pattern', async () => {
      const sql = `CREATE FUNCTION test_permission_bitnum_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  bitlen int;
  v_len int;
BEGIN
  v_len := 32;
  BEGIN
    bitlen := bit_length(NEW.bitstr);
  EXCEPTION
    WHEN others THEN
      bitlen := 0;
  END;
  IF bitlen = 0 THEN
    NEW.bitstr := lpad('', v_len, '0');
  END IF;
  RETURN NEW;
END$$`;

      await testUtils.expectAstMatch('permission bitnum trigger', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      // Verify the nested block with exception is properly terminated
      expect(deparsed).toContain('EXCEPTION');
      expect(deparsed).toContain('RETURN NEW');
    });

    it('should handle multi-step sign-in pattern', async () => {
      const sql = `CREATE FUNCTION test_signin_pattern(v_email text) RETURNS record
LANGUAGE plpgsql AS $$
DECLARE
  v_user record;
  v_secret record;
BEGIN
  SELECT * INTO v_user FROM users WHERE email = v_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  SELECT * INTO v_secret FROM secrets WHERE user_id = v_user.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_CREDENTIALS';
  END IF;
  IF v_secret.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'ACCOUNT_LOCKED';
  END IF;
  RETURN v_user;
END$$`;

      await testUtils.expectAstMatch('signin pattern', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
    });
  });

  describe('DML RETURNING ... INTO re-insertion', () => {
    const countKeyword = (sql: string, keyword: string): number =>
      (sql.match(new RegExp(`\\b${keyword}\\b`, 'gi')) || []).length;

    const expectKeywordsPreserved = (original: string, deparsed: string) => {
      expect(countKeyword(deparsed, 'INTO')).toBeGreaterThanOrEqual(countKeyword(original, 'INTO'));
      expect(countKeyword(deparsed, 'RETURNING')).toBeGreaterThanOrEqual(countKeyword(original, 'RETURNING'));
    };

    it('should re-insert INTO after RETURNING for INSERT', async () => {
      const sql = `CREATE FUNCTION test_insert_returning_into() RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO s.t (name) VALUES ('x') RETURNING id INTO v_id;
  RETURN v_id;
END$$`;

      await testUtils.expectAstMatch('INSERT RETURNING INTO', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('RETURNING id INTO v_id');
      expectKeywordsPreserved(sql, deparsed);
    });

    it('should re-insert INTO after RETURNING for UPDATE', async () => {
      const sql = `CREATE FUNCTION test_update_returning_into() RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE s.t SET name = 'y' WHERE name = 'x' RETURNING id INTO v_id;
  RETURN v_id;
END$$`;

      await testUtils.expectAstMatch('UPDATE RETURNING INTO', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('RETURNING id INTO v_id');
      expectKeywordsPreserved(sql, deparsed);
    });

    it('should re-insert INTO after RETURNING for DELETE', async () => {
      const sql = `CREATE FUNCTION test_delete_returning_into() RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  DELETE FROM s.t WHERE name = 'x' RETURNING id INTO v_id;
  RETURN v_id;
END$$`;

      await testUtils.expectAstMatch('DELETE RETURNING INTO', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('RETURNING id INTO v_id');
      expectKeywordsPreserved(sql, deparsed);
    });

    it('should preserve STRICT in RETURNING ... INTO STRICT', async () => {
      const sql = `CREATE FUNCTION test_insert_returning_into_strict() RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO s.t (name) VALUES ('x') RETURNING id INTO STRICT v_id;
  RETURN v_id;
END$$`;

      await testUtils.expectAstMatch('INSERT RETURNING INTO STRICT', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('RETURNING id INTO STRICT v_id');
      expectKeywordsPreserved(sql, deparsed);
    });

    it('should handle multi-column RETURNING ... INTO', async () => {
      const sql = `CREATE FUNCTION test_insert_returning_multi_into() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  v_name text;
BEGIN
  INSERT INTO s.t (name) VALUES ('x') RETURNING id, name INTO v_id, v_name;
END$$`;

      await testUtils.expectAstMatch('INSERT RETURNING multi INTO', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('RETURNING id, name INTO v_id, v_name');
      expectKeywordsPreserved(sql, deparsed);
    });

    it('should not insert INTO inside a RETURNING subquery', async () => {
      const sql = `CREATE FUNCTION test_insert_returning_subquery_into() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_total bigint;
BEGIN
  INSERT INTO s.t (name) VALUES ('x') RETURNING (SELECT count(*) FROM s.t WHERE name = 'x') INTO v_total;
END$$`;

      await testUtils.expectAstMatch('INSERT RETURNING subquery INTO', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      // INTO must be appended after the subquery, not inside it
      expect(deparsed).toContain(`(SELECT count(*) FROM s.t WHERE name = 'x') INTO v_total`);
      expectKeywordsPreserved(sql, deparsed);
    });
  });

  describe('implicit trailing RETURN suppression', () => {
    it('should not emit implicit compiler-generated RETURN in trigger function', async () => {
      const sql = `CREATE FUNCTION test_trigger_no_final_return() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
END$$`;

      await testUtils.expectAstMatch('trigger no final return', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      // The compiler-generated implicit final RETURN must not be emitted
      // (bare RETURN; is a syntax error inside trigger functions)
      expect(deparsed).not.toMatch(/RETURN;/);
    });

    it('should preserve explicit trailing RETURN in void function', async () => {
      const sql = `CREATE FUNCTION test_void_explicit_return() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE 'hi';
  RETURN;
END$$`;

      await testUtils.expectAstMatch('void explicit return', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toMatch(/RETURN;/);
    });

    it('should leave trigger function ending in RETURN NEW unchanged', async () => {
      const sql = `CREATE FUNCTION test_trigger_return_new() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$`;

      await testUtils.expectAstMatch('trigger return new', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('RETURN NEW');
      expect(deparsed).not.toMatch(/RETURN;/);
    });
  });

  describe('cursor SCROLL options', () => {
    it('should keep SCROLL on the cursor declaration, not OPEN', async () => {
      const sql = `CREATE FUNCTION test_scroll_cursor() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  c SCROLL CURSOR FOR SELECT id FROM s.t ORDER BY id;
  v int;
BEGIN
  OPEN c;
  FETCH PRIOR FROM c INTO v;
  CLOSE c;
  RETURN v;
END$$`;

      await testUtils.expectAstMatch('scroll cursor declaration', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('SCROLL CURSOR FOR');
      expect(deparsed).not.toMatch(/OPEN\s+(NO\s+)?SCROLL/i);
      expect(deparsed).not.toMatch(/OPEN\s+c\s+(NO\s+)?SCROLL/i);
    });

    it('should not add SCROLL to OPEN of a plain bound cursor', async () => {
      const sql = `CREATE FUNCTION test_plain_cursor() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  c CURSOR FOR SELECT id FROM s.t;
  v int;
BEGIN
  OPEN c;
  FETCH c INTO v;
  CLOSE c;
END$$`;

      await testUtils.expectAstMatch('plain cursor open', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('OPEN c');
      expect(deparsed).not.toMatch(/SCROLL/i);
    });
  });

  describe('FETCH/MOVE directions', () => {
    it('should preserve counts and FIRST/LAST directions', async () => {
      const sql = `CREATE FUNCTION test_move_directions() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  c SCROLL CURSOR FOR SELECT id FROM s.t ORDER BY id;
BEGIN
  OPEN c;
  MOVE FORWARD 3 FROM c;
  MOVE BACKWARD 2 FROM c;
  MOVE FORWARD ALL FROM c;
  MOVE BACKWARD ALL FROM c;
  MOVE LAST IN c;
  MOVE FIRST IN c;
  CLOSE c;
END$$`;

      await testUtils.expectAstMatch('move directions', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('FORWARD 3');
      expect(deparsed).toContain('BACKWARD 2');
      expect(deparsed).toContain('BACKWARD ALL');
      expect(deparsed).toContain('LAST');
      expect(deparsed).toContain('FIRST');
    });
  });

  describe('SQLSTATE exception conditions', () => {
    it('should emit SQLSTATE codes with the SQLSTATE keyword', async () => {
      const sql = `CREATE FUNCTION test_sqlstate_cond() RETURNS integer
LANGUAGE plpgsql AS $$
BEGIN
  RETURN 1;
EXCEPTION
  WHEN unique_violation OR SQLSTATE '23503' THEN
    RETURN -1;
  WHEN SQLSTATE 'P0001' THEN
    RETURN -2;
END$$`;

      await testUtils.expectAstMatch('sqlstate condition', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain(`SQLSTATE '23503'`);
      expect(deparsed).toContain(`SQLSTATE 'P0001'`);
      expect(deparsed).not.toMatch(/WHEN\s+23503/);
    });
  });

  describe('bare RAISE re-throw', () => {
    it('should keep a bare RAISE bare (not RAISE EXCEPTION;)', async () => {
      const sql = `CREATE FUNCTION test_bare_raise() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END$$`;

      await testUtils.expectAstMatch('bare raise', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toMatch(/RAISE;/);
      expect(deparsed).not.toMatch(/RAISE EXCEPTION;/);
    });

    it('should still emit level and message for normal RAISE', async () => {
      const sql = `CREATE FUNCTION test_raise_msg() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'boom %', 42 USING HINT = 'h';
  RAISE NOTICE 'hi';
END$$`;

      await testUtils.expectAstMatch('raise with message', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain(`RAISE EXCEPTION 'boom %', 42`);
      expect(deparsed).toContain(`RAISE NOTICE 'hi'`);
    });
  });

  describe('subscripted assignment targets', () => {
    it('should not parenthesize array element assignment targets', async () => {
      const sql = `CREATE FUNCTION test_array_assign() RETURNS int[]
LANGUAGE plpgsql AS $$
DECLARE
  a int[] := ARRAY[1, 2, 3, 4, 5];
  m int[][] := ARRAY[ARRAY[1, 2], ARRAY[3, 4]];
BEGIN
  a[2] := 20;
  a[2:3] := ARRAY[9, 9];
  m[1][2] := 42;
  RETURN a;
END$$`;

      await testUtils.expectAstMatch('array element assignment', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('a[2] := 20');
      expect(deparsed).toContain('m[1][2] := 42');
      expect(deparsed).not.toMatch(/\(a\)\[/);
      expect(deparsed).not.toMatch(/\(m\)\[/);
    });
  });

  describe('uppercase %ROWTYPE/%TYPE references', () => {
    it('should not quote uppercase %ROWTYPE and %TYPE references', async () => {
      const sql = `CREATE FUNCTION test_rowtype_case() RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r myschema.users%ROWTYPE;
  n myschema.users.name%TYPE;
BEGIN
  NULL;
END;
$$`;

      await testUtils.expectAstMatch('uppercase rowtype/type refs', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toMatch(/myschema\.users%ROWTYPE/i);
      expect(deparsed).not.toContain('"users%ROWTYPE"');
      expect(deparsed).not.toContain('"name%TYPE"');
    });
  });

  describe('bound cursor arguments', () => {
    it('should emit the parameter list of a bound cursor and not redeclare its args', async () => {
      const sql = `CREATE FUNCTION test_bound_cursor_args() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  c CURSOR (key int, label text) FOR SELECT * FROM users WHERE id = key AND name = label;
  r record;
BEGIN
  OPEN c(42, 'x');
  FETCH c INTO r;
  CLOSE c;
END$$`;

      await testUtils.expectAstMatch('bound cursor args', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toMatch(/c CURSOR \(key int, label text\) FOR/);
      // The cursor args must not leak out as standalone DECLARE variables
      expect(deparsed).not.toMatch(/^\s*key int;/m);
      expect(deparsed).not.toMatch(/^\s*label text;/m);
    });
  });

  describe('RAISE with SQLSTATE condition', () => {
    it('should emit SQLSTATE codes as SQLSTATE literals, not bare numbers', async () => {
      const sql = `CREATE FUNCTION test_raise_sqlstate() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE SQLSTATE '22012';
END$$`;

      await testUtils.expectAstMatch('raise sqlstate', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toMatch(/RAISE EXCEPTION SQLSTATE '22012'/i);
      expect(deparsed).not.toMatch(/RAISE EXCEPTION 22012/);
    });

    it('should keep named conditions as bare identifiers', async () => {
      const sql = `CREATE FUNCTION test_raise_named_condition() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION division_by_zero;
END$$`;

      await testUtils.expectAstMatch('raise named condition', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toMatch(/RAISE EXCEPTION division_by_zero/i);
      expect(deparsed).not.toMatch(/SQLSTATE/i);
    });
  });

  describe('top-level EXCEPTION wrapper block', () => {
    it('should not emit a nested BEGIN for a top-level block with EXCEPTION', async () => {
      const sql = `CREATE FUNCTION test_toplevel_exception(a numeric, b numeric) RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE
  v_result numeric;
BEGIN
  v_result := a / b;
  RETURN v_result;
EXCEPTION
  WHEN division_by_zero THEN
    RETURN NULL;
END$$`;

      await testUtils.expectAstMatch('top-level exception block', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).not.toMatch(/BEGIN\s+BEGIN/i);
    });

    it('should preserve an explicit nested block with EXCEPTION', async () => {
      const sql = `CREATE FUNCTION test_explicit_nested_exception(p_id integer) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_result text;
BEGIN
  v_result := 'unknown';
  BEGIN
    SELECT status INTO v_result FROM items WHERE id = p_id;
  EXCEPTION
    WHEN no_data_found THEN
      v_result := 'not_found';
  END;
  RETURN v_result;
END$$`;

      await testUtils.expectAstMatch('explicit nested exception block', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      const beginCount = (deparsed.match(/BEGIN/g) ?? []).length;
      expect(beginCount).toBe(2);
    });
  });

  describe('ALIAS declarations', () => {
    it('should preserve ALIAS FOR a positional parameter', async () => {
      const sql = `CREATE FUNCTION test_alias_positional_param(integer) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  arg ALIAS FOR $1;
BEGIN
  RETURN arg + 1;
END$$`;

      await testUtils.expectAstMatch('alias for positional parameter', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('arg ALIAS FOR $1;');
    });

    it('should interleave aliases with variable declarations by source order', async () => {
      const sql = `CREATE FUNCTION test_alias_named(input_value text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  val ALIAS FOR input_value;
  buffer text := 'x';
  buf ALIAS FOR buffer;
BEGIN
  buf := buf || val;
  RETURN buf;
END$$`;

      await testUtils.expectAstMatch('aliases interleaved with variables', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      // the alias of a local variable must come after that variable's declaration
      expect(deparsed.indexOf('buf ALIAS FOR buffer;')).toBeGreaterThan(deparsed.indexOf('buffer text'));
      expect(deparsed).toContain('val ALIAS FOR input_value;');
    });

    it('should preserve ALIAS FOR OLD/NEW in trigger functions', async () => {
      const sql = `CREATE FUNCTION test_alias_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  prior ALIAS FOR old;
  updated ALIAS FOR new;
BEGIN
  updated.updated_at := now();
  RETURN updated;
END$$`;

      await testUtils.expectAstMatch('alias for OLD/NEW in trigger', sql);

      const parsed = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
      const deparsed = deparseSync(parsed);
      expect(deparsed).toMatchSnapshot();
      expect(deparsed).toContain('prior ALIAS FOR old;');
      expect(deparsed).toContain('updated ALIAS FOR new;');
    });
  });
});
