-- String values containing single quotes must stay inside one literal
-- Ref: constructive-io/pgsql-parser#355
PREPARE TRANSACTION 'it''s';
COMMIT PREPARED 'it''s';
ROLLBACK PREPARED 'it''s';
NOTIFY ch, 'it''s';
LOAD 'it''s.so';
CREATE TABLESPACE ts LOCATION '/tmp/it''s';
SECURITY LABEL ON TABLE t IS 'it''s';
CREATE SUBSCRIPTION s CONNECTION 'host=it''s' PUBLICATION p;
CREATE CONVERSION c FOR 'it''s' TO 'UTF8' FROM f;
SET search_path = 'it''s';
CREATE INDEX i ON t USING gist (c opc (opt = 'it''s'));
CREATE INDEX i ON t (c) WITH (opt = 'it''s');
CREATE TABLE t (a int) WITH (opt = 'it''s');
ALTER TABLE t SET (opt = 'it''s');
CREATE FOREIGN DATA WRAPPER w OPTIONS (opt 'it''s');
ALTER FOREIGN DATA WRAPPER w OPTIONS (ADD opt 'it''s');
CREATE SERVER s FOREIGN DATA WRAPPER w OPTIONS (host 'it''s');
CREATE USER MAPPING FOR u SERVER s OPTIONS (password 'it''s');
CREATE FOREIGN TABLE ft (a int OPTIONS (col 'it''s')) SERVER s;
CREATE ROLE r PASSWORD 'it''s';
CREATE ROLE r VALID UNTIL 'it''s';
ALTER EXTENSION e UPDATE TO 'it''s';
CREATE EVENT TRIGGER e ON ddl_command_start WHEN TAG IN ('it''s', 'CREATE TABLE') EXECUTE FUNCTION f();
CREATE TYPE ty (input = i, output = o, category = '''');
CREATE AGGREGATE agg (int) (sfunc = f, stype = int, initcond = 'it''s');
CREATE COLLATION c (locale = 'it''s');
CREATE TRIGGER tr BEFORE INSERT ON t FOR EACH ROW EXECUTE FUNCTION f('it''s', 'b');

-- XMLTABLE
SELECT * FROM XMLTABLE('/r' PASSING doc COLUMNS a int PATH 'it''s');
SELECT * FROM XMLTABLE('/r' PASSING doc COLUMNS a int PATH 'a', b text PATH 'b''c' DEFAULT 'd' NOT NULL, n FOR ORDINALITY);
SELECT * FROM XMLTABLE(XMLNAMESPACES('http://x' AS x, DEFAULT 'http://d'), '/x:r' PASSING (SELECT doc FROM t) COLUMNS a int) AS xt;
SELECT * FROM t, LATERAL XMLTABLE('/r' PASSING t.doc COLUMNS a int PATH 'a') xt;

-- Numeric literals with underscores
SELECT 1_000.000_1, 1_000.5e1_0, 0x_FFFF_FFFF_FFFF_FFFF;
