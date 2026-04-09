-- Comments with special characters: don't break "parsing"
SELECT 1;

-- Inline comment after statement
SELECT 2; -- trailing note

-- Adjacent comments with no blank line
-- first line
-- second line
SELECT 3;

-- Dollar-quoted body with internal comments (should NOT be extracted)
CREATE FUNCTION app.noop() RETURNS void AS $$
BEGIN
  -- this comment is inside the function body
  NULL;
END;
$$ LANGUAGE plpgsql;

-- String that looks like a comment
SELECT '-- not a comment' AS val;

-- Empty statement list edge
SELECT 4;
