-- Function with comments inside loops
CREATE FUNCTION process_batch(p_batch_size integer) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_processed integer := 0;
  r RECORD;
BEGIN
  -- Process items in batches
  FOR r IN SELECT id, data FROM pending_items LIMIT p_batch_size LOOP
    -- Process each item
    PERFORM process_item(r.id, r.data);
    v_processed := v_processed + 1;
  END LOOP;

  -- Return the count of processed items
  RETURN v_processed;
END;
$$;
