-- Edge-case literals the deparser must keep valid
-- Ref: constructive-io/constructive-planning#2175

-- Empty bit-string literals
SELECT X'';
SELECT B'';
SELECT X'', B'', X'1F', B'101';

-- Dollar-quoted bodies that contain the default or fallback delimiter
DO $x$ BEGIN RAISE NOTICE '$_PGFN_$'; END $x$;
DO $x$ BEGIN RAISE NOTICE '$$'; END $x$;
DO $x$ BEGIN RAISE NOTICE '$$ $EOFCODE$'; END $x$;
DO $x$ BEGIN RAISE NOTICE '$$ $EOFCODE$ $EOFCODE1$'; END $x$;
DO $x$BEGIN NULL; END; --$$x$;
CREATE FUNCTION f() RETURNS int LANGUAGE sql AS $x$ SELECT length('$_PGFN_$') $x$;
CREATE FUNCTION f() RETURNS int LANGUAGE sql AS $x$ SELECT length('$$ $EOFCODE$') $x$;
CREATE FUNCTION f() RETURNS int LANGUAGE sql AS $x$SELECT 1 --$$x$;

-- String option values must keep their case and stay strings
CREATE VIEW v WITH (security_barrier = 'Foo') AS SELECT 1;
CREATE VIEW v WITH (security_barrier = 'true') AS SELECT 1;
CREATE INDEX i ON t (a) WITH (fillfactor = 'int');
CREATE INDEX i ON t (a) WITH (opt = 'Foo');
CREATE TABLE t (a int) WITH (opt = 'Foo');
CREATE TABLE t (a int) WITH (opt = 'int');
CREATE TABLE t (a int) WITH (opt = 'select');
ALTER TABLE t SET (opt = 'Foo');
ALTER TABLE t SET (opt = 'int');
ALTER INDEX i SET (opt = 'Foo');
