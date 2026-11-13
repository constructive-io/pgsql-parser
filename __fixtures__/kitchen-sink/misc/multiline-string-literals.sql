-- A string literal that spans lines must keep its exact value: pretty mode may
-- indent the SQL around it but never the lines inside it.

-- Column DEFAULT
CREATE TABLE t (memo text DEFAULT 'line one
line two');
CREATE TABLE t (id int PRIMARY KEY, memo text NOT NULL DEFAULT 'line one
  line two
    line three', n int);
CREATE TABLE t (memo text DEFAULT E'tab\there
back\\slash
quote''s');
CREATE TABLE t (memo text DEFAULT 'it''s
''quoted''
');
CREATE TABLE t (memo text DEFAULT '
');
CREATE TABLE t (memo text DEFAULT '

leading and trailing blank lines

');
CREATE TABLE t (a text DEFAULT 'first
literal', b text DEFAULT 'second
literal', c text DEFAULT 'one line');
CREATE TABLE t (memo text DEFAULT $body$dollar 'quoted'
  body $$ with
a tag$body$);
CREATE TABLE t (memo text DEFAULT 'a
b' || 'c
d');
CREATE TABLE t (memo text DEFAULT concat('a
b', upper('c
d')));
CREATE TABLE t (memo text GENERATED ALWAYS AS (other || '
suffix') STORED, other text);

-- Column and table CHECK constraints
CREATE TABLE t (memo text CHECK (memo <> 'line one
line two'));
CREATE TABLE t (memo text, CHECK (memo <> 'line one
line two'));
CREATE TABLE t (memo text, kind text, CONSTRAINT memo_ok CHECK (memo <> 'line one
line two' AND kind IN ('a
b', 'c') OR memo IS NULL));
CREATE TABLE t (memo text, CONSTRAINT memo_ok CHECK (memo <> 'line one
line two') NOT VALID, CONSTRAINT memo_len CHECK (length(memo) < 10));
CREATE TABLE s.t (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo text NOT NULL DEFAULT 'line one
line two',
  kind text NOT NULL DEFAULT 'plain',
  owner_id uuid REFERENCES s.owners (id) ON DELETE CASCADE,
  CONSTRAINT memo_ok CHECK (memo <> 'x
y'),
  UNIQUE (owner_id, kind)
);
CREATE DOMAIN d AS text DEFAULT 'a
b' CHECK (VALUE <> 'c
d');

-- ALTER TABLE
ALTER TABLE t ALTER COLUMN memo SET DEFAULT 'line one
line two';
ALTER TABLE t ADD COLUMN memo text DEFAULT 'line one
line two';
ALTER TABLE t ADD COLUMN memo text NOT NULL DEFAULT 'line one
line two' CHECK (memo <> 'x
y');
ALTER TABLE t ADD CONSTRAINT memo_ok CHECK (memo <> 'line one
line two');
ALTER TABLE t ADD CONSTRAINT memo_ok CHECK (memo <> 'line one
line two' AND memo <> 'x
y') NOT VALID;
ALTER TABLE t ALTER COLUMN memo TYPE text USING coalesce(memo, 'line one
line two');
ALTER TABLE t ADD COLUMN a text DEFAULT 'a
b', ALTER COLUMN c SET DEFAULT 'c
d', ADD CONSTRAINT e CHECK (c <> 'e
f');
ALTER DOMAIN d SET DEFAULT 'a
b';
ALTER DOMAIN d ADD CONSTRAINT c CHECK (VALUE <> 'a
b');

-- CREATE POLICY / ALTER POLICY
CREATE POLICY p ON t USING (memo = 'line one
line two');
CREATE POLICY p ON t FOR INSERT WITH CHECK (memo = 'line one
line two');
CREATE POLICY p ON s.t AS RESTRICTIVE FOR UPDATE TO authenticated USING (memo = 'line one
line two' AND owner_id = current_user_id()) WITH CHECK (memo <> 'x
y' OR kind = 'k
l');
CREATE POLICY p ON t FOR SELECT USING (EXISTS (SELECT 1 FROM u WHERE u.memo = 'line one
line two' AND u.id = t.id));
ALTER POLICY p ON t USING (memo = 'line one
line two') WITH CHECK (memo = 'x
y');

-- CREATE TRIGGER / CREATE RULE
CREATE TRIGGER trg BEFORE UPDATE ON t FOR EACH ROW WHEN (new.memo = 'line one
line two') EXECUTE FUNCTION f();
CREATE TRIGGER trg AFTER INSERT OR UPDATE OF memo ON s.t FOR EACH ROW WHEN (new.memo IS DISTINCT FROM 'line one
line two' AND old.memo <> 'x
y') EXECUTE FUNCTION s.f('arg one
arg two', 'b');
CREATE TRIGGER trg BEFORE INSERT ON t FOR EACH ROW EXECUTE FUNCTION f('arg one
arg two');
CREATE CONSTRAINT TRIGGER trg AFTER INSERT ON t DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (new.memo = 'a
b') EXECUTE FUNCTION f();
CREATE RULE r AS ON INSERT TO t WHERE new.memo = 'a
b' DO INSTEAD INSERT INTO u (memo) VALUES ('c
d');
CREATE RULE r AS ON UPDATE TO t DO ALSO (INSERT INTO u (memo) VALUES ('c
d'); UPDATE v SET memo = 'e
f' WHERE id = new.id);

-- INSERT
INSERT INTO t (id, memo) VALUES (1, 'line one
line two');
INSERT INTO t (id, memo) VALUES (1, 'a
b'), (2, 'c
d'), (3, 'e');
INSERT INTO t (id, memo) VALUES (1, 'a') ON CONFLICT (id) DO UPDATE SET memo = 'line one
line two';
INSERT INTO t (id, memo, kind) VALUES (1, 'a
b', 'k') ON CONFLICT (id) WHERE kind = 'k
l' DO UPDATE SET memo = excluded.memo || '
appended', kind = 'x
y' WHERE t.memo <> 'p
q' RETURNING memo, 'r
s' AS tag;
INSERT INTO t (id, memo) SELECT id, 'line one
line two' FROM u WHERE memo = 'x
y';
INSERT INTO t (memo) VALUES ('a
b') ON CONFLICT ON CONSTRAINT t_pkey DO NOTHING RETURNING 'c
d';
WITH src AS (SELECT 'a
b' AS memo) INSERT INTO t (memo) SELECT memo FROM src ON CONFLICT (memo) DO UPDATE SET memo = 'c
d';

-- UPDATE / DELETE / MERGE
UPDATE t SET memo = 'line one
line two' WHERE id = 1;
UPDATE t SET memo = 'a
b', kind = 'c
d' FROM u WHERE u.id = t.id AND u.memo = 'e
f' RETURNING t.memo, 'g
h';
UPDATE t SET (memo, kind) = ('a
b', 'c
d') WHERE id = 1;
UPDATE t SET memo = (SELECT 'a
b' FROM u WHERE u.memo = 'c
d' LIMIT 1) WHERE id IN (SELECT id FROM v WHERE memo = 'e
f');
DELETE FROM t WHERE memo = 'line one
line two';
DELETE FROM t USING u WHERE t.id = u.id AND u.memo = 'a
b' AND t.memo = 'c
d' RETURNING 'e
f';
MERGE INTO t USING u ON t.id = u.id AND u.memo = 'a
b' WHEN MATCHED AND t.memo = 'c
d' THEN UPDATE SET memo = 'e
f' WHEN NOT MATCHED THEN INSERT (id, memo) VALUES (u.id, 'g
h');

-- SELECT clauses
SELECT 'line one
line two';
SELECT 'a
b' AS x, 'c
d' AS y, id FROM t;
SELECT id FROM t WHERE memo = 'line one
line two';
SELECT id FROM t WHERE memo = 'a
b' AND kind = 'c
d' OR (memo <> 'e
f' AND kind IS NULL);
SELECT id FROM t WHERE memo IN ('a
b', 'c
d') AND kind LIKE 'e
%' AND memo BETWEEN 'f
g' AND 'h
i';
SELECT t.id FROM t JOIN u ON u.id = t.id AND u.memo = 'a
b' LEFT JOIN v ON v.id = t.id AND v.memo = 'c
d' AND v.kind = 'a long enough condition to be wrapped onto its own line';
SELECT kind, count(*) FROM t GROUP BY kind, memo || 'a
b' HAVING max(memo) = 'c
d' ORDER BY kind || 'e
f', 2 LIMIT 5;
SELECT DISTINCT ON (memo || 'a
b') memo FROM t;
SELECT * FROM (SELECT 'a
b' AS memo, id FROM t WHERE kind = 'c
d') sub WHERE sub.memo = 'e
f';
SELECT * FROM t WHERE EXISTS (SELECT 1 FROM u WHERE u.memo = 'a
b' AND u.id = t.id) AND id = ANY (SELECT id FROM v WHERE memo = 'c
d');
SELECT 'a
b' UNION ALL SELECT 'c
d' UNION ALL SELECT memo FROM t WHERE memo = 'e
f';
SELECT * FROM (VALUES (1, 'a
b'), (2, 'c
d')) AS v (id, memo);
VALUES (1, 'a
b'), (2, 'c
d');
SELECT * FROM f('a
b', 'c') AS x, LATERAL g(x.id, 'd
e') AS y;
SELECT 'a
b'::text, CAST('c
d' AS varchar(20)), text 'e
f';
SELECT E'a\nb
c', U&'d\0061
e', B'101', X'1F', N'f
g';
SELECT $$dollar
quoted$$, $tag$with 'quotes'
and $$ inside$tag$;
SELECT 'trailing space 
and	tab
', '  leading spaces
  kept';
SELECT "quoted
identifier" FROM "quoted
table" AS "alias
name" WHERE "quoted
identifier" = 'a
b';

-- CASE, function arguments, aggregates and window functions
SELECT CASE WHEN memo = 'a
b' THEN 'c
d' WHEN kind = 'k' THEN 'one line' ELSE 'e
f' END FROM t;
SELECT CASE memo WHEN 'a
b' THEN 1 ELSE 2 END, CASE WHEN id > 1 THEN CASE WHEN memo = 'c
d' THEN 'e
f' ELSE 'g' END END FROM t;
SELECT concat('a
b', memo, 'c
d'), coalesce(memo, 'e
f'), nullif(memo, 'g
h'), greatest('i
j', memo) FROM t;
SELECT string_agg(memo, ',
' ORDER BY memo || 'a
b') FILTER (WHERE memo <> 'c
d') FROM t;
SELECT count(*) FILTER (WHERE memo = 'a
b') OVER (PARTITION BY kind || 'c
d' ORDER BY memo || 'e
f' ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t;
SELECT lag(memo, 1, 'a
b') OVER w FROM t WINDOW w AS (PARTITION BY memo = 'c
d' ORDER BY id);
SELECT format('%s
%s', 'a', 'b'), regexp_replace(memo, '\s
', 'x
y', 'g') FROM t;
SELECT f(a => 'a
b', b := 'c
d');

-- Array and row constructors
SELECT ARRAY['a
b', 'c
d'], ARRAY[ARRAY['e
f'], ARRAY['g']], ROW('h
i', 2), ('j
k', 'l');
SELECT * FROM t WHERE (memo, kind) = ('a
b', 'c
d') AND memo = ANY (ARRAY['e
f', 'g']);
SELECT '{"a
b","c"}'::text[], '{"k": "v
w"}'::jsonb -> 'k', jsonb_build_object('a
b', 'c
d');

-- CTEs
WITH a AS (SELECT 'a
b' AS memo) SELECT memo FROM a WHERE memo = 'c
d';
WITH a AS (SELECT 'a
b' AS memo), b AS (SELECT memo FROM a WHERE memo <> 'c
d'), c AS MATERIALIZED (SELECT 'one line' AS memo) SELECT * FROM b UNION ALL SELECT 'e
f' FROM c;
WITH RECURSIVE r (n, memo) AS (SELECT 1, 'a
b' UNION ALL SELECT n + 1, memo || 'c
d' FROM r WHERE n < 3) SELECT * FROM r;
WITH upd AS (UPDATE t SET memo = 'a
b' WHERE memo = 'c
d' RETURNING id), del AS (DELETE FROM u WHERE memo = 'e
f' RETURNING id) SELECT * FROM upd, del;

-- Views, materialized views, CREATE TABLE AS
CREATE VIEW v AS SELECT id, 'line one
line two' AS memo FROM t WHERE kind = 'a
b';
CREATE OR REPLACE VIEW s.v (id, memo) WITH (security_barrier = true) AS SELECT id, CASE WHEN memo = 'a
b' THEN 'c
d' ELSE memo END FROM t WHERE memo <> 'e
f' WITH CHECK OPTION;
CREATE MATERIALIZED VIEW mv AS SELECT 'a
b' AS memo FROM t WHERE memo = 'c
d' WITH NO DATA;
CREATE TABLE t2 AS SELECT 'a
b' AS memo FROM t WHERE memo = 'c
d';
SELECT 'a
b' AS memo INTO t3 FROM t WHERE memo = 'c
d';

-- Indexes
CREATE INDEX i ON t (lower(memo)) WHERE memo <> 'line one
line two';
CREATE UNIQUE INDEX i ON s.t USING btree ((memo || 'a
b'), kind) WHERE memo <> 'c
d' AND kind = 'e
f';
ALTER TABLE t ADD CONSTRAINT ex EXCLUDE USING gist (memo WITH =) WHERE (memo <> 'a
b');

-- COMMENT ON / SECURITY LABEL
COMMENT ON TABLE t IS 'line one
line two';
COMMENT ON COLUMN s.t.memo IS 'line one
  indented line two

line four';
COMMENT ON FUNCTION f(int, text) IS E'tab\there
second line';
COMMENT ON CONSTRAINT memo_ok ON t IS 'a
b';
COMMENT ON POLICY p ON t IS 'a
b';
COMMENT ON TRIGGER trg ON t IS 'a
b';
SECURITY LABEL FOR p ON TABLE t IS 'a
b';

-- Functions, procedures, DO blocks
CREATE FUNCTION f() RETURNS text LANGUAGE sql AS $$SELECT 'line one
line two'$$;
CREATE FUNCTION f(a text DEFAULT 'a
b', b text DEFAULT 'c') RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT a || 'c
d';
$$;
CREATE FUNCTION f(a text DEFAULT 'a
b') RETURNS text LANGUAGE sql RETURN a || 'c
d';
CREATE FUNCTION f() RETURNS SETOF text LANGUAGE sql BEGIN ATOMIC SELECT 'a
b'; SELECT memo FROM t WHERE memo = 'c
d'; END;
CREATE FUNCTION f() RETURNS trigger LANGUAGE plpgsql SET search_path = 'a
b' AS $fn$
BEGIN
  IF new.memo = 'line one
line two' THEN
    RAISE EXCEPTION 'bad
memo';
  END IF;
  RETURN new;
END;
$fn$;
CREATE PROCEDURE p(a text DEFAULT 'a
b') LANGUAGE sql AS $$INSERT INTO t (memo) VALUES ('c
d')$$;
DO $$
BEGIN
  RAISE NOTICE 'line one
line two';
END
$$;
CALL p('a
b', x => 'c
d');

-- Types, sequences and other DDL carrying strings
CREATE TYPE e AS ENUM ('a
b', 'c');
ALTER TYPE e ADD VALUE 'd
e' BEFORE 'a
b';
ALTER TYPE e RENAME VALUE 'a
b' TO 'f
g';
CREATE TABLE p1 PARTITION OF p FOR VALUES IN ('a
b', 'c
d');
CREATE TABLE p2 PARTITION OF p (memo DEFAULT 'a
b') FOR VALUES FROM ('c
d') TO ('e
f');
CREATE AGGREGATE agg (text) (SFUNC = f, STYPE = text, INITCOND = 'a
b');
CREATE FOREIGN TABLE ft (memo text OPTIONS (column_name 'c
d') DEFAULT 'a
b') SERVER srv OPTIONS (table_name 'e
f');
CREATE SERVER srv FOREIGN DATA WRAPPER w OPTIONS (host 'a
b');
ALTER ROLE r SET search_path = 'a
b';
SET application_name = 'a
b';
CREATE EXTENSION x WITH SCHEMA s VERSION 'a
b';
COPY t (memo) FROM STDIN WITH (FORMAT csv, NULL 'a
b', DELIMITER ',') WHERE memo <> 'c
d';
COPY (SELECT 'a
b' FROM t WHERE memo = 'c
d') TO STDOUT;
PREPARE q (text) AS SELECT $1 || 'a
b' FROM t WHERE memo = 'c
d';
EXECUTE q ('a
b');
EXPLAIN (ANALYZE) SELECT 'a
b' FROM t WHERE memo = 'c
d';
DECLARE c CURSOR FOR SELECT 'a
b' FROM t WHERE memo = 'c
d';
NOTIFY ch, 'a
b';
GRANT SELECT ON t TO r;
CREATE PUBLICATION pub FOR TABLE t WHERE (memo <> 'a
b');
CREATE STATISTICS st ON (memo || 'a
b'), kind FROM t;
CREATE SCHEMA s CREATE TABLE t (memo text DEFAULT 'a
b') CREATE VIEW v AS SELECT 'c
d' AS memo;
