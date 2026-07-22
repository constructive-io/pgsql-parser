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

-- Test 38: INSERT ... RETURNING ... INTO (INTO must be re-inserted after RETURNING)
CREATE FUNCTION test_insert_returning_into() RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO s.t (name) VALUES ('x') RETURNING id INTO v_id;
  RETURN v_id;
END$$;

-- Test 39: UPDATE ... RETURNING ... INTO
CREATE FUNCTION test_update_returning_into() RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE s.t SET name = 'y' WHERE name = 'x' RETURNING id INTO v_id;
  RETURN v_id;
END$$;

-- Test 40: DELETE ... RETURNING ... INTO
CREATE FUNCTION test_delete_returning_into() RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  DELETE FROM s.t WHERE name = 'x' RETURNING id INTO v_id;
  RETURN v_id;
END$$;

-- Test 41: INSERT ... RETURNING ... INTO STRICT
CREATE FUNCTION test_insert_returning_into_strict() RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO s.t (name) VALUES ('x') RETURNING id INTO STRICT v_id;
  RETURN v_id;
END$$;

-- Test 42: INSERT ... RETURNING multiple columns INTO
CREATE FUNCTION test_insert_returning_multi_into() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  v_name text;
BEGIN
  INSERT INTO s.t (name) VALUES ('x') RETURNING id, name INTO v_id, v_name;
END$$;

-- Test 43: INSERT ... RETURNING expression with subquery INTO (INTO must not land inside the subquery)
CREATE FUNCTION test_insert_returning_subquery_into() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_total bigint;
BEGIN
  INSERT INTO s.t (name) VALUES ('x') RETURNING (SELECT count(*) FROM s.t WHERE name = 'x') INTO v_total;
END$$;

-- Test 44: Trigger function with no final return (implicit compiler RETURN must not be emitted)
CREATE FUNCTION test_trigger_no_final_return() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
END$$;

-- Test 45: Void function with explicit trailing RETURN (must be preserved)
CREATE FUNCTION test_void_explicit_return() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE 'hi';
  RETURN;
END$$;

-- Test 46: Trigger function ending in RETURN NEW (unchanged)
CREATE FUNCTION test_trigger_return_new() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

-- Test 47: Bound cursor declared with SCROLL (option must stay on the declaration, not OPEN)
CREATE FUNCTION test_scroll_cursor_decl() RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  c SCROLL CURSOR FOR SELECT id FROM s.t ORDER BY id;
  v int;
BEGIN
  OPEN c;
  FETCH PRIOR FROM c INTO v;
  CLOSE c;
  RETURN v;
END$$;

-- Test 48: Bound cursor declared with NO SCROLL
CREATE FUNCTION test_no_scroll_cursor_decl() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  c NO SCROLL CURSOR FOR SELECT id FROM s.t;
  v int;
BEGIN
  OPEN c;
  FETCH c INTO v;
  CLOSE c;
END$$;

-- Test 49: Plain bound cursor (OPEN must not gain a SCROLL keyword)
CREATE FUNCTION test_plain_cursor_open() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  c CURSOR FOR SELECT id FROM s.t;
  v int;
BEGIN
  OPEN c;
  FETCH c INTO v;
  CLOSE c;
END$$;

-- Test 50: MOVE with count/expression directions (counts must be preserved)
CREATE FUNCTION test_move_directions() RETURNS void
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
  CLOSE c;
END$$;

-- Test 51: Exception handler with SQLSTATE condition (must emit SQLSTATE 'xxxxx')
CREATE FUNCTION test_sqlstate_condition() RETURNS int
LANGUAGE plpgsql AS $$
BEGIN
  RETURN 1;
EXCEPTION
  WHEN unique_violation OR SQLSTATE '23503' THEN
    RETURN -1;
  WHEN SQLSTATE 'P0001' THEN
    RETURN -2;
END$$;

-- Test 52: Bare RAISE re-throw inside an exception handler (must stay bare)
CREATE FUNCTION test_bare_raise_rethrow() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END$$;

-- Test 53: Array element and slice assignment (target must not be parenthesized)
CREATE FUNCTION test_array_element_assignment() RETURNS int[]
LANGUAGE plpgsql AS $$
DECLARE
  a int[] := ARRAY[1, 2, 3, 4, 5];
  m int[][] := ARRAY[ARRAY[1, 2], ARRAY[3, 4]];
BEGIN
  a[2] := 20;
  a[2:3] := ARRAY[9, 9];
  m[1][2] := 42;
  RETURN a;
END$$;

-- Test 54: Bound cursor with explicit arguments (must emit the parameter list)
CREATE FUNCTION test_bound_cursor_args() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  c CURSOR (key int, label text) FOR SELECT * FROM users WHERE id = key AND name = label;
  r record;
BEGIN
  OPEN c(42, 'x');
  FETCH c INTO r;
  CLOSE c;
END$$;

-- Test 55: RAISE with a SQLSTATE condition code (must emit SQLSTATE 'xxxxx', not a bare number)
CREATE FUNCTION test_raise_sqlstate() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE SQLSTATE '22012';
END$$;

-- Test 56: RAISE EXCEPTION with a named condition (must stay a bare identifier)
CREATE FUNCTION test_raise_named_condition() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION division_by_zero;
END$$;

-- Test 57: Bare RETURN NEXT with OUT parameters (retvarno points at out_param_varno; must stay bare)
CREATE FUNCTION test_return_next_out_params(OUT x integer, OUT y text) RETURNS SETOF record
LANGUAGE plpgsql AS $$
BEGIN
  FOR i IN 1..5 LOOP
    x := i;
    y := 'item_' || i::text;
    RETURN NEXT;
  END LOOP;
  RETURN;
END$$;

-- Test 58: RETURN NEXT with a variable (retvarno must be emitted as the variable name)
CREATE FUNCTION test_return_next_var() RETURNS SETOF integer
LANGUAGE plpgsql AS $$
DECLARE
  r integer;
BEGIN
  FOR r IN SELECT g FROM generate_series(1, 3) g LOOP
    RETURN NEXT r;
  END LOOP;
END$$;

-- Test 59: Top-level block with EXCEPTION clause (compiler wraps it in a synthetic outer block; must not deparse a nested BEGIN)
CREATE FUNCTION test_toplevel_exception(a numeric, b numeric) RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE
  v_result numeric;
BEGIN
  v_result := a / b;
  RETURN v_result;
EXCEPTION
  WHEN division_by_zero THEN
    RETURN NULL;
END$$;

-- Test 60: Explicit nested block with EXCEPTION inside a top-level block (nesting must be preserved)
CREATE FUNCTION test_explicit_nested_exception(p_id integer) RETURNS text
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
END$$;

-- Test 61: Bare RETURN in function whose single OUT param is not the first datum
-- (libpg-query 18 omits out_param_varno, so the OUT datum must be resolved by name)
CREATE FUNCTION test_out_param_bare_return(
  IN a text,
  IN b uuid,
  OUT result uuid
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := b;
  SELECT v_id INTO result;
  RETURN;
END$$;

-- Test 62: Bare RETURN with multiple OUT params (unnamed-row OUT datum)
CREATE FUNCTION test_multi_out_bare_return(
  IN a integer,
  OUT x integer,
  OUT y text
)
LANGUAGE plpgsql AS $$
BEGIN
  x := a;
  y := 'ok';
  RETURN;
END$$;

-- Test 63: ALIAS FOR a positional parameter (alias declaration must be preserved)
CREATE FUNCTION test_alias_positional_param(integer) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  arg ALIAS FOR $1;
BEGIN
  RETURN arg + 1;
END$$;

-- Test 64: ALIAS FOR a named parameter and a local variable
CREATE FUNCTION test_alias_named(input_value text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  val ALIAS FOR input_value;
  buffer text := 'x';
  buf ALIAS FOR buffer;
BEGIN
  buf := buf || val;
  RETURN buf;
END$$;

-- Test 65: ALIAS FOR OLD/NEW in a trigger function
CREATE FUNCTION test_alias_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  prior ALIAS FOR old;
  updated ALIAS FOR new;
BEGIN
  updated.updated_at := now();
  RETURN updated;
END$$;
