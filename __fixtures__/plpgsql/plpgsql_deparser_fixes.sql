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
