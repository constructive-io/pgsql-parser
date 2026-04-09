-- Add columns to existing table
ALTER TABLE app.users ADD COLUMN bio text;
ALTER TABLE app.users ADD COLUMN avatar_url text;

-- Rename a column
ALTER TABLE app.users RENAME COLUMN username TO display_name;

-- Drop unused objects
DROP INDEX IF EXISTS app.idx_old_index;

-- Recreate with new definition
CREATE INDEX idx_users_display_name ON app.users (display_name);
