-- A mixed migration file: schema DDL, a clean function, and a dirty one.
CREATE SCHEMA app_public;

CREATE TABLE app_public.users (
  id serial primary key,
  email text not null
);

CREATE FUNCTION app_public.clean() RETURNS setof app_public.users
LANGUAGE sql
AS $$
  SELECT * FROM app_public.users
$$;

CREATE FUNCTION app_public.dirty() RETURNS setof app_public.users
LANGUAGE sql
AS $$
  SELECT * FROM users
$$;
