-- Arrows (→) and dashes (—) are multi-byte in UTF-8: every parser offset
-- after this comment is a byte offset, not a UTF-16 index.
CREATE SCHEMA app_public;

CREATE FUNCTION app_public.pinned() RETURNS void
LANGUAGE sql
SET search_path = app_public
AS $$
  SELECT 1
$$;

CREATE FUNCTION app_public.dynamic(x text) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('SELECT %s', x);
END;
$$;

CREATE FUNCTION app_public.dirty() RETURNS setof app_public.users
LANGUAGE sql
AS $$
  -- 日本語
  SELECT * FROM users
$$;
