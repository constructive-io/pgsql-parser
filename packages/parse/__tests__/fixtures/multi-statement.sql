-- Schema setup
CREATE SCHEMA IF NOT EXISTS app;

-- Users table
CREATE TABLE app.users (
  id serial PRIMARY KEY,
  username text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Roles table
CREATE TABLE app.roles (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL
);

-- Junction table
CREATE TABLE app.user_roles (
  user_id integer REFERENCES app.users (id),
  role_id integer REFERENCES app.roles (id),
  PRIMARY KEY (user_id, role_id)
);

-- Seed default roles
INSERT INTO app.roles (name) VALUES ('admin'), ('viewer');
