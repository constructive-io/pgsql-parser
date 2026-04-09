-- Simple function with body comments
CREATE FUNCTION get_user_count() RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Count all active users
  SELECT count(*) INTO v_count FROM users WHERE is_active = true;
  RETURN v_count;
END;
$$;
