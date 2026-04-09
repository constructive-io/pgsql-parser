-- Deploy schemas/my-app/tables/users to pg
-- requires: schemas/my-app/schema

BEGIN;

-- Create the main users table
CREATE TABLE my_app.users (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE
);

-- Add an index for fast lookups
CREATE INDEX idx_users_email ON my_app.users (email);

COMMIT;
