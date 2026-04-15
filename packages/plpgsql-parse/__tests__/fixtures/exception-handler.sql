-- Function with comments in exception handler
CREATE FUNCTION safe_divide(a numeric, b numeric) RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_result numeric;
BEGIN
  -- Attempt the division
  v_result := a / b;
  RETURN v_result;
EXCEPTION
  WHEN division_by_zero THEN
    -- Log the error and return null
    RAISE NOTICE 'Division by zero: % / %', a, b;
    RETURN NULL;
END;
$$;
