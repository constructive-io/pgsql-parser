-- CTE SEARCH / CYCLE clauses
WITH RECURSIVE graph(f, t, label) AS (SELECT 1, 2, 'a' UNION ALL SELECT g.f, g.t, g.label FROM graph g) SEARCH DEPTH FIRST BY f, t SET seq SELECT * FROM graph;
WITH RECURSIVE graph(f, t, label) AS (SELECT 1, 2, 'a' UNION ALL SELECT g.f, g.t, g.label FROM graph g) SEARCH BREADTH FIRST BY f, t SET seq SELECT * FROM graph;
WITH RECURSIVE graph(f, t, label) AS (SELECT 1, 2, 'a' UNION ALL SELECT g.f, g.t, g.label FROM graph g) CYCLE f, t SET is_cycle USING path SELECT * FROM graph;
WITH RECURSIVE graph(f, t, label) AS (SELECT 1, 2, 'a' UNION ALL SELECT g.f, g.t, g.label FROM graph g) CYCLE f, t SET is_cycle TO 'Y' DEFAULT 'N' USING path SELECT * FROM graph;
WITH RECURSIVE graph(f, t, label) AS (SELECT 1, 2, 'a' UNION ALL SELECT g.f, g.t, g.label FROM graph g) CYCLE f, t SET is_cycle TO point '(1,1)' DEFAULT point '(0,0)' USING path SELECT * FROM graph;
WITH RECURSIVE graph(f, t, label) AS (SELECT 1, 2, 'a' UNION ALL SELECT g.f, g.t, g.label FROM graph g) SEARCH DEPTH FIRST BY f, t SET seq CYCLE f, t SET is_cycle USING path SELECT * FROM graph;
-- INSERT OVERRIDING
INSERT INTO itest1 OVERRIDING USER VALUE VALUES (10, 'xyz');
INSERT INTO itest1 (a, b) OVERRIDING SYSTEM VALUE VALUES (10, 'xyz');
INSERT INTO itest1 OVERRIDING SYSTEM VALUE SELECT * FROM itest2;
MERGE INTO tgt t USING src s ON t.a = s.a WHEN NOT MATCHED THEN INSERT (a) OVERRIDING SYSTEM VALUE VALUES (s.a);
-- multi-column assignment in MERGE
MERGE INTO tgt t USING src s ON t.a = s.a WHEN MATCHED THEN UPDATE SET (b, c) = (SELECT s.b, s.c);
MERGE INTO tgt t USING src s ON t.a = s.a WHEN MATCHED THEN UPDATE SET (b, c) = (s.b, s.c), d = 1;
UPDATE tgt SET (b, c) = (SELECT 1, 2), d = 3;
