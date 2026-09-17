-- COMMENT ON CONSTRAINT ... ON DOMAIN
COMMENT ON CONSTRAINT the_constraint ON DOMAIN constraint_comments_dom IS 'yes, another comment';
COMMENT ON CONSTRAINT the_constraint ON DOMAIN s.constraint_comments_dom IS NULL;
COMMENT ON CONSTRAINT the_constraint ON constraint_comments_tbl IS 'table constraint';
-- DEFAULT needs parens around non-b_expr expressions
CREATE TABLE error_tbl (b1 bool DEFAULT (1 IN (1, 2)));
CREATE TABLE error_tbl (b1 bool DEFAULT (true AND false));
CREATE TABLE error_tbl (b1 bool DEFAULT ('a' LIKE 'a%'));
CREATE TABLE error_tbl (b1 bool DEFAULT (1 BETWEEN 0 AND 2));
CREATE TABLE error_tbl (b1 bool DEFAULT (1 = ANY (ARRAY[1, 2])));
CREATE TABLE error_tbl (b1 int DEFAULT 1 + 2);
CREATE TABLE error_tbl (b1 bool DEFAULT 1 IS DISTINCT FROM 2);
ALTER TABLE error_tbl ALTER COLUMN b1 SET DEFAULT (1 IN (1, 2));
-- EXCLUDE constraint deferrability
CREATE TABLE deferred_excl (f1 int, f2 int, CONSTRAINT deferred_excl_con EXCLUDE (f1 WITH =) INITIALLY DEFERRED);
CREATE TABLE deferred_excl (f1 int, CONSTRAINT deferred_excl_con EXCLUDE (f1 WITH =) DEFERRABLE INITIALLY DEFERRED);
CREATE TABLE deferred_excl (f1 int, CONSTRAINT deferred_excl_con EXCLUDE USING gist (f1 WITH =) NOT DEFERRABLE);
ALTER TABLE deferred_excl ADD CONSTRAINT deferred_excl_con2 EXCLUDE (f1 WITH =) DEFERRABLE INITIALLY IMMEDIATE;
