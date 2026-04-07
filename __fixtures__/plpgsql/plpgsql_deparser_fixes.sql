-- Fixtures to test deparser fixes from constructive-db PR #229
-- These exercise: PERFORM, INTO clause placement, record field qualification, RETURN handling

-- Test 1: PERFORM statement (parser stores as SELECT, deparser must strip SELECT)
CREATE FUNCTION test_perform_basic() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('test_channel', 'message');
  RETURN NEW;
END$$;

-- Test 2: PERFORM with function call and arguments
CREATE FUNCTION test_perform_with_args() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    PERFORM pg_notify(TG_ARGV[0], to_json(NEW)::text);
    RETURN NEW;
  END IF;
  IF (TG_OP = 'DELETE') THEN
    PERFORM pg_notify(TG_ARGV[0], to_json(OLD)::text);
    RETURN OLD;
  END IF;
  RETURN NULL;
END$$;

-- Test 3: INTO clause with record field target (recfield qualification)
CREATE FUNCTION test_into_record_field() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT
    NEW.is_approved IS TRUE
      AND NEW.is_verified IS TRUE
      AND NEW.is_disabled IS FALSE INTO NEW.is_active;
  RETURN NEW;
END$$;

-- Test 4: INTO clause with subquery (depth-aware scanner must skip nested FROM)
CREATE FUNCTION test_into_with_subquery() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  result_value int;
BEGIN
  SELECT count(*) INTO result_value
  FROM (SELECT id FROM users WHERE id = NEW.user_id) sub;
  RETURN NEW;
END$$;

-- Test 5: INTO clause with multiple record fields
CREATE FUNCTION test_into_multiple_fields() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT is_active, is_verified INTO NEW.is_active, NEW.is_verified
  FROM users WHERE id = NEW.user_id;
  RETURN NEW;
END$$;

-- Test 6: SETOF function with RETURN QUERY and bare RETURN
CREATE FUNCTION test_setof_return_query(p_limit int)
RETURNS SETOF int
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY SELECT generate_series(1, p_limit);
  RETURN;
END$$;

-- Test 7: SETOF function with RETURN NEXT
CREATE FUNCTION test_setof_return_next(p_count int)
RETURNS SETOF text
LANGUAGE plpgsql AS $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..p_count LOOP
    RETURN NEXT 'item_' || i::text;
  END LOOP;
  RETURN;
END$$;

-- Test 8: Void function with bare RETURN
CREATE FUNCTION test_void_function(p_value text)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE 'Value: %', p_value;
  RETURN;
END$$;

-- Test 9: Scalar function with RETURN NULL
CREATE FUNCTION test_scalar_return_null()
RETURNS int
LANGUAGE plpgsql AS $$
BEGIN
  RETURN NULL;
END$$;

-- Test 10: Scalar function with conditional RETURN
CREATE FUNCTION test_scalar_conditional(p_value int)
RETURNS int
LANGUAGE plpgsql AS $$
BEGIN
  IF p_value > 0 THEN
    RETURN p_value * 2;
  END IF;
  RETURN NULL;
END$$;

-- Test 11: OUT parameter function with bare RETURN
CREATE FUNCTION test_out_params(OUT ok boolean, OUT message text)
LANGUAGE plpgsql AS $$
BEGIN
  ok := true;
  message := 'success';
  RETURN;
END$$;

-- Test 12: RETURNS TABLE function with RETURN QUERY
CREATE FUNCTION test_returns_table(p_prefix text)
RETURNS TABLE(id int, name text)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY SELECT 1, p_prefix || '_one';
  RETURN QUERY SELECT 2, p_prefix || '_two';
  RETURN;
END$$;

-- Test 13: Trigger function with complex logic
CREATE FUNCTION test_trigger_complex() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  defaults_record record;
  bit_len int;
BEGIN
  bit_len := bit_length(NEW.permissions);
  
  SELECT * INTO defaults_record
  FROM permission_defaults AS t
  LIMIT 1;
  
  IF found THEN
    NEW.is_approved := defaults_record.is_approved;
    NEW.is_verified := defaults_record.is_verified;
  END IF;
  
  IF NEW.is_owner IS TRUE THEN
    NEW.is_admin := true;
    NEW.is_approved := true;
    NEW.is_verified := true;
  END IF;
  
  SELECT
    NEW.is_approved IS TRUE
      AND NEW.is_verified IS TRUE
      AND NEW.is_disabled IS FALSE INTO NEW.is_active;
  
  RETURN NEW;
END$$;

-- Test 14: Procedure (implicit void return)
CREATE PROCEDURE test_procedure(p_message text)
LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE '%', p_message;
END$$;

-- Test 15: OUT parameters with SELECT INTO multiple variables
-- This pattern is used in auth functions (sign_in, sign_up) where we need to
-- populate multiple OUT parameters from a single SELECT statement
CREATE FUNCTION test_out_params_select_into(
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
END$$;

-- Test 16: OUT parameters with SELECT INTO and STRICT
CREATE FUNCTION test_out_params_strict(
  p_id uuid,
  OUT name text,
  OUT email text
)
LANGUAGE plpgsql AS $$
BEGIN
  SELECT u.name, u.email INTO STRICT name, email
  FROM users u
  WHERE u.id = p_id;
END$$;

-- =============================================================================
-- Edge Case Tests: Nested Block Compositions (END; bug class)
-- These test the exact bug class where END; of a nested block could be
-- confused with statement keywords that follow it.
-- =============================================================================

-- Test 17: Nested block followed by RETURN (the original END; bug pattern)
CREATE FUNCTION test_nested_block_return() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_result integer;
BEGIN
  BEGIN
    v_result := 1;
  END;
  RETURN v_result;
END$$;

-- Test 18: Nested block followed by IF
CREATE FUNCTION test_nested_block_if() RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM setup_something();
  END;
  IF FOUND THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END$$;

-- Test 19: Nested block followed by RAISE
CREATE FUNCTION test_nested_block_raise() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM risky_operation();
  END;
  RAISE NOTICE 'Operation completed';
  RETURN;
END$$;

-- Test 20: Nested block followed by PERFORM
CREATE FUNCTION test_nested_block_perform() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_count integer;
BEGIN
  BEGIN
    v_count := 42;
  END;
  PERFORM log_result(v_count);
  RETURN v_count;
END$$;

-- Test 21: Nested block followed by assignment
CREATE FUNCTION test_nested_block_assign() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
BEGIN
  BEGIN
    PERFORM init();
  END;
  v_status := 'complete';
  RETURN v_status;
END$$;

-- Test 22: Labeled nested block
CREATE FUNCTION test_labeled_nested_block() RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  <<inner>>
  BEGIN
    PERFORM do_work();
  END inner;
  RETURN TRUE;
END$$;

-- =============================================================================
-- Edge Case Tests: Blocks Inside Control Structures
-- =============================================================================

-- Test 23: Block inside IF THEN branch with exception handler
CREATE FUNCTION test_block_in_if() RETURNS integer
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
END$$;

-- Test 24: Block inside LOOP body with exception handler
CREATE FUNCTION test_block_in_loop() RETURNS void
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
END$$;

-- Test 25: Block inside CASE WHEN
CREATE FUNCTION test_block_in_case(p_status text) RETURNS void
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
END$$;

-- =============================================================================
-- Edge Case Tests: Deep Nesting & Sequential Blocks
-- =============================================================================

-- Test 26: Two sequential nested blocks
CREATE FUNCTION test_sequential_blocks() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM step_one();
  END;
  BEGIN
    PERFORM step_two();
  END;
  RETURN;
END$$;

-- Test 27: Triple-nested blocks
CREATE FUNCTION test_triple_nested() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    BEGIN
      PERFORM deep_call();
    END;
    RAISE NOTICE 'middle';
  END;
  RETURN;
END$$;

-- Test 28: Block inside exception handler action
CREATE FUNCTION test_block_in_exception() RETURNS void
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
END$$;

-- =============================================================================
-- Edge Case Tests: Untested Statement Types
-- =============================================================================

-- Test 29: FOR integer loop
CREATE FUNCTION test_for_integer_loop() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  FOR i IN 1..10 LOOP
    PERFORM process(i);
  END LOOP;
  RETURN;
END$$;

-- Test 30: FOR query loop
CREATE FUNCTION test_for_query_loop() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT id, name FROM my_table LOOP
    PERFORM handle(rec);
  END LOOP;
  RETURN;
END$$;

-- Test 31: Labeled FOR loop with EXIT
CREATE FUNCTION test_labeled_for_loop() RETURNS void
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
END$$;

-- Test 32: RETURN NEXT in set-returning function with OUT parameters
CREATE FUNCTION test_return_next_out(OUT x integer, OUT y text) RETURNS SETOF record
LANGUAGE plpgsql AS $$
BEGIN
  FOR i IN 1..5 LOOP
    x := i;
    y := 'item_' || i::text;
    RETURN NEXT;
  END LOOP;
  RETURN;
END$$;

-- Test 33: RETURN QUERY
CREATE FUNCTION test_return_query_simple() RETURNS SETOF record
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY SELECT id, name FROM my_table WHERE active = TRUE;
END$$;

-- Test 34: ASSERT statement
CREATE FUNCTION test_assert(p_x integer) RETURNS integer
LANGUAGE plpgsql AS $$
BEGIN
  ASSERT p_x > 0, 'x must be positive';
  RETURN p_x;
END$$;

-- Test 35: CALL statement
CREATE FUNCTION test_call_statement() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  CALL my_procedure(1, 'hello');
  RETURN;
END$$;

-- =============================================================================
-- Edge Case Tests: Real-World Patterns
-- =============================================================================

-- Test 36: Permission bitnum trigger pattern (the function that exposed the END; bug)
CREATE FUNCTION test_permission_bitnum_trigger() RETURNS trigger
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
END$$;

-- Test 37: Multi-step sign-in pattern (deeply nested IF chains)
CREATE FUNCTION test_signin_pattern(v_email text) RETURNS record
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
END$$;
