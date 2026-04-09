-- Deploy schemas/app/functions/get_user to pg
-- requires: schemas/app/tables/users

BEGIN;

-- Function to get a user by ID
CREATE FUNCTION app.get_user(p_id integer)
RETURNS TABLE (id integer, username text, created_at timestamptz) AS $$
BEGIN
  -- Return the matching user
  RETURN QUERY
  SELECT u.id, u.username, u.created_at
  FROM app.users u
  WHERE u.id = p_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION app.get_user(integer) TO authenticated;

COMMIT;
