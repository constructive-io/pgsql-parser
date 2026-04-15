-- Function with nested blocks and comments
CREATE FUNCTION complex_logic(p_id integer) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_result text;
BEGIN
  -- Initialize result
  v_result := 'unknown';

  -- Try the main logic
  BEGIN
    -- Fetch and process
    SELECT status INTO v_result FROM items WHERE id = p_id;
  EXCEPTION
    WHEN no_data_found THEN
      -- Handle missing item
      v_result := 'not_found';
  END;

  RETURN v_result;
END;
$$;
