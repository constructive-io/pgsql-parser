-- Multiple functions in one file
-- with outer SQL comments preserved

CREATE FUNCTION add_numbers(a integer, b integer) RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  -- Simple addition
  RETURN a + b;
END;
$$;

-- Second function with its own body comments
CREATE FUNCTION multiply_numbers(a integer, b integer) RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  -- Multiply the inputs
  RETURN a * b;
END;
$$;
