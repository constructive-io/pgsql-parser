-- Qualified ALTER TYPE / ALTER DOMAIN RENAME must dot-join the name
-- Ref: constructive-io/pgsql-parser#328
ALTER TYPE app.t2 RENAME TO t;
ALTER DOMAIN app.d2 RENAME TO d;

-- GRANT/REVOKE ON SEQUENCE must keep the SEQUENCE keyword
-- Ref: constructive-io/pgsql-parser#328
GRANT ALL ON SEQUENCE app.seq TO bob;
GRANT USAGE, SELECT ON SEQUENCE app.seq TO bob;
REVOKE ALL ON SEQUENCE app.seq FROM bob;
REVOKE UPDATE ON SEQUENCE app.seq FROM bob RESTRICT;
