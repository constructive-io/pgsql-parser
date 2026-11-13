-- The target of a subscript, slice, field selection or .* must stay
-- parenthesized whenever it is anything other than a plain column or parameter.

-- ARRAY constructors
SELECT (ARRAY[1, 2, 3])[2];
SELECT (ARRAY[1, 2, 3])[2:3];
SELECT (ARRAY[1, 2, 3])[:2], (ARRAY[1, 2, 3])[2:], (ARRAY[1, 2, 3])[:];
SELECT (ARRAY[ARRAY[1, 2], ARRAY[3, 4]])[1][2];
SELECT (ARRAY[ARRAY[1, 2], ARRAY[3, 4]])[1:2][2:2];
SELECT (ARRAY[[1, 2], [3, 4]])[2][1];
SELECT (ARRAY['a', 'b'])[i] FROM t;
SELECT (ARRAY(SELECT id FROM t ORDER BY id))[1];
SELECT (ARRAY[]::int[])[1];
SELECT (ARRAY[ROW(1, 'a')::rt, ROW(2, 'b')::rt])[1].f1;

-- ROW constructors and composite field selection
SELECT (ROW(1, 2)).f1;
SELECT (ROW(1, 2)::rt).*;
SELECT (ROW(1, ROW(2, 3)::inner_t)::outer_t).f2.f1;
SELECT ((1, 2)::rt).f1;
SELECT (t.c).f1, (t.c).*, (c).f1, (s.t.c).f1 FROM s.t;
SELECT (t.c).f1.f2, ((t.c).f1).f2, (t.arr[1]).f1, (t.c).arr[1] FROM t;
SELECT (t).*, (t.*).f1 FROM t;
SELECT (c).f1[1], (c).f1[1:2].g FROM t;

-- Casts
SELECT ('{1,2,3}'::int[])[1];
SELECT ('{1,2,3}'::int[])[1:2];
SELECT (CAST('{1,2,3}' AS int[]))[1];
SELECT ('(1,2)'::rt).f1, ('(1,2)'::rt).*;
SELECT (c::int[])[1], (c::text[])[i + 1][j] FROM t;
SELECT ('{"a": [1, 2]}'::jsonb)['a'][0];
SELECT (int4range(1, 5)::text)[1];
SELECT (TIMESTAMP '2001-02-16 20:38:40')[1];

-- Function calls
SELECT (f(x)).*;
SELECT (f(x)).a, (s.f(x, y)).a.b, (f()).*;
SELECT (f(x))[1], (f(x))[1:2], (f(x))[1].a;
SELECT (string_to_array('a,b', ','))[1];
SELECT (regexp_match(memo, '(a)(b)'))[2] FROM t;
SELECT (array_agg(id ORDER BY id))[1] FROM t;
SELECT (array_agg(id) FILTER (WHERE id > 1))[1:2] FROM t;
SELECT (array_agg(id) OVER (PARTITION BY kind))[1] FROM t;
SELECT (coalesce(a, b))[1], (nullif(a, b))[1], (greatest(a, b)).f1 FROM t;
SELECT (current_schemas(true))[1], (CURRENT_USER)[1];
SELECT (each(h)).key, (each(h)).value FROM t;
SELECT (jsonb_populate_record(NULL::rt, j)).* FROM t;
SELECT (unnest(ARRAY[ROW(1, 2)::rt])).f1;

-- Subselects
SELECT (SELECT arr FROM t LIMIT 1)[1];
SELECT (SELECT arr FROM t LIMIT 1)[1:2];
SELECT (SELECT c FROM t LIMIT 1).f1;
SELECT (SELECT c FROM t LIMIT 1).*;
SELECT (SELECT array_agg(id) FROM t)[1], ((SELECT array_agg(id) FROM t))[2];
SELECT (ARRAY(SELECT id FROM t))[1:2];

-- Operator and boolean expressions
SELECT (a || b)[1] FROM t;
SELECT (a || b)[1:2], (a || ARRAY[1])[1], (ARRAY[1] || a)[2] FROM t;
SELECT (a -> 'k')[0], (a #> '{x,y}')[1], (- a)[1] FROM t;
SELECT (a + b).f1, (a OPERATOR(pg_catalog.||) b)[1] FROM t;
SELECT (a AND b)[1], (NOT a)[1], (a IS NULL)[1], (a IN (1, 2))[1] FROM t;
SELECT (a BETWEEN 1 AND 2)[1], (a LIKE 'x')[1], (a IS DISTINCT FROM b)[1] FROM t;
SELECT (a = ANY (b))[1], (a AT TIME ZONE 'UTC')[1], (a COLLATE "C")[1] FROM t;
SELECT (EXISTS (SELECT 1))[1], (a IS TRUE)[1], (a IS NOT DOCUMENT)[1] FROM t;

-- CASE and other compound expressions
SELECT (CASE WHEN x THEN a ELSE b END)[1] FROM t;
SELECT (CASE WHEN x THEN a ELSE b END)[1:2], (CASE x WHEN 1 THEN c END).f1 FROM t;
SELECT (COALESCE(a, b))[1], (NULLIF(a, b))[1], (GREATEST(a, b))[1], (LEAST(a, b)).f1 FROM t;
SELECT ($1)[1], $1[1], ($1).f1, ($1::int[])[1], $2[1:2];
SELECT ('{1,2}')[1], (NULL)[1], (1)[1], (TRUE)[1];
SELECT (a[1])[2], a[1][2], ((a)[1])[2], (a[1:2])[1] FROM t;
SELECT (GROUPING(a))[1] FROM t GROUP BY a;
SELECT (XMLELEMENT(NAME x))[1], (JSON_OBJECT('a': 1))[1], (JSON_ARRAY(1, 2))[1];
SELECT (EXTRACT(year FROM d))[1], (SUBSTRING(s FROM 1 FOR 2))[1], (TRIM(s))[1], (POSITION('a' IN s))[1], (OVERLAY(s PLACING 'x' FROM 1))[1] FROM t;
SELECT (CURRENT_TIMESTAMP)[1], (CURRENT_DATE)[1], (LOCALTIME)[1], (SESSION_USER)[1], (CURRENT_CATALOG)[1];
SELECT (DEFAULT)[1] FROM t;

-- Nested and combined
SELECT ((ARRAY[1, 2, 3])[2:3])[1];
SELECT ((f(x)).arr)[1], ((f(x)).arr[1]).g, (((f(x)).a).b).c;
SELECT ((ARRAY[ROW(1, ARRAY[2, 3])::rt])[1]).f2[1];
SELECT ((a || b)[1:2] || c)[1], (((a)))[1] FROM t;
SELECT (ARRAY[(ARRAY[1, 2])[1], (f(x))[2]])[1];
SELECT (ARRAY[1, 2, 3])[(SELECT 1)], (ARRAY[1, 2, 3])[(ARRAY[1, 2])[1]], (ARRAY[1, 2, 3])[(f(x))[1]] FROM t;
SELECT (ARRAY[1, 2, 3])[1]::text, - (ARRAY[1, 2, 3])[1], (ARRAY[1, 2, 3])[1] + (f(x)).a, NOT (ARRAY[TRUE])[1];
SELECT f((ARRAY[1, 2, 3])[1], (g(x)).a), count((f(x)).a) FROM t;

-- Outside the SELECT list
SELECT * FROM t WHERE (ARRAY[1, 2, 3])[t.i] = 2 AND (f(t.x)).ok ORDER BY (string_to_array(t.s, ','))[1], (t.c).f1;
SELECT * FROM t JOIN u ON (t.c).id = (u.c).id AND (ARRAY[t.a, t.b])[1] = u.a GROUP BY (t.c).f1 HAVING (array_agg(u.a))[1] > 0;
SELECT * FROM generate_series(1, (ARRAY[3, 4])[1]) AS g, LATERAL (SELECT (ARRAY[1, 2])[g]) s;
SELECT (x).* FROM (SELECT f(y) AS x FROM t) sub;
INSERT INTO t (a, b) VALUES ((ARRAY[1, 2, 3])[2], (ROW(1, 2)::rt).f1);
INSERT INTO t (a) SELECT (f(x)).a FROM u ON CONFLICT (a) DO UPDATE SET a = (ARRAY[excluded.a, t.a])[1] RETURNING (t.c).f1;
UPDATE t SET a = (ARRAY[1, 2, 3])[2], b = (f(x)).b, arr[1] = (ARRAY[5])[1], c.f1 = (c).f1 + 1 WHERE (c).f1 = (string_to_array(s, ','))[1]::int;
UPDATE t SET (a, b) = (SELECT (f(x)).a, (ARRAY[1, 2])[1]);
DELETE FROM t WHERE (ARRAY['a', 'b'])[i] = s RETURNING (c).*;
CREATE TABLE t (a int DEFAULT (ARRAY[1, 2, 3])[2], b int CHECK (b > (ARRAY[1, 2, 3])[1]), c rt, CHECK ((c).f1 > 0));
CREATE TABLE t (a int GENERATED ALWAYS AS ((string_to_array(s, ','))[1]::int) STORED, s text);
ALTER TABLE t ALTER COLUMN a SET DEFAULT (ARRAY[1, 2, 3])[2], ADD CONSTRAINT k CHECK ((c).f1 > (f(a)).lo);
ALTER TABLE t ALTER COLUMN a TYPE int USING (string_to_array(a, ','))[1]::int;
CREATE INDEX i ON t (((c).f1), ((string_to_array(s, ','))[1])) WHERE (c).f2 IS NOT NULL;
CREATE VIEW v AS SELECT (ARRAY[1, 2, 3])[2] AS a, (f(x)).* FROM t;
CREATE POLICY p ON t USING ((string_to_array(current_setting('x'), ','))[1] = owner) WITH CHECK ((c).f1 > 0);
CREATE TRIGGER trg BEFORE UPDATE ON t FOR EACH ROW WHEN ((new.c).f1 IS DISTINCT FROM (old.c).f1 AND (ARRAY[1, 2])[1] = 1) EXECUTE FUNCTION f();
CREATE FUNCTION f(a int[] DEFAULT ARRAY[1], b int DEFAULT (ARRAY[1, 2, 3])[2]) RETURNS int LANGUAGE sql RETURN (ARRAY[a[1], b])[1];
CREATE DOMAIN d AS int[] CHECK ((VALUE)[1] > 0 AND (array_remove(VALUE, NULL))[1] IS NOT NULL);
WITH x AS (SELECT (ARRAY[1, 2, 3])[2:3] AS a) SELECT (a)[1], (x.a)[1], (SELECT (a)[2]) FROM x;
SELECT CASE WHEN (ARRAY[1, 2])[1] = 1 THEN (f(x)).a ELSE (ROW(1, 2)::rt).f1 END FROM t;
SELECT sum((c).f1) OVER (PARTITION BY (ARRAY[a, b])[1] ORDER BY (f(x)).a) FROM t;
PREPARE q (int[], rt) AS SELECT $1[1], ($2).f1, ($1)[1:2], ($1 || $1)[1];
