-- Mid-statement comments are hoisted above their enclosing statement.
-- The deparser cannot inject comments back into the middle of a
-- statement, so they are preserved as standalone lines above it.

-- Simple mid-statement comment
SELECT
  id, -- the primary key
  name
FROM users;

-- Multiple mid-statement comments in one query
SELECT
  u.id,       -- user ID
  u.name,     -- display name
  r.role_name -- role from join
FROM users u
JOIN roles r ON r.id = u.role_id;

-- Mid-statement comment in INSERT values
INSERT INTO logs (level, message)
VALUES (
  'info', -- log level
  'hello' -- log body
);

-- Comment between clauses
SELECT id
FROM users
-- filter active only
WHERE active = true;
