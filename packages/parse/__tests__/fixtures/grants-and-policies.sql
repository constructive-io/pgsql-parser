-- RLS policies for the users table
ALTER TABLE app.users ENABLE ROW LEVEL SECURITY;

-- Admins can see all rows
CREATE POLICY admin_all ON app.users
  FOR ALL
  TO admin_role
  USING (true);

-- Users can only see their own row
CREATE POLICY own_row ON app.users
  FOR SELECT
  TO authenticated
  USING (id = current_setting('app.current_user_id')::integer);

-- Grant basic access
GRANT USAGE ON SCHEMA app TO authenticated;
GRANT SELECT ON app.users TO authenticated;
GRANT ALL ON app.users TO admin_role;
