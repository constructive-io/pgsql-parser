-- TABLESPACE / USING INDEX TABLESPACE / INCLUDE / WITH on table and constraint definitions
-- Ref: PostgreSQL regress tablespace.sql, create_table.sql, constraints.sql
CREATE TABLE testschema.foo (i int) TABLESPACE regress_tblspace;
CREATE TABLE t (a int) ON COMMIT DROP TABLESPACE ts;
CREATE TABLE t (a int) USING heap TABLESPACE ts;
CREATE TABLE testschema.dflt (a int PRIMARY KEY USING INDEX TABLESPACE regress_tblspace) PARTITION BY LIST (a) TABLESPACE pg_default;
CREATE TABLE testschema.part_1 PARTITION OF testschema.part FOR VALUES IN (1) TABLESPACE "My Space";
CREATE TABLE t (a int, b int, PRIMARY KEY (a) INCLUDE (b) WITH (fillfactor=10) USING INDEX TABLESPACE ts DEFERRABLE);
CREATE TABLE t (a int UNIQUE NULLS NOT DISTINCT USING INDEX TABLESPACE "My Space");
CREATE TABLE t (a int, CONSTRAINT u UNIQUE (a) INCLUDE (a) WITH (fillfactor=50));
CREATE TABLE t (a int, EXCLUDE USING gist (a WITH =) INCLUDE (a) WITH (fillfactor=10) USING INDEX TABLESPACE ts WHERE (a > 0));
ALTER TABLE testschema.atable ADD CONSTRAINT anindex_t UNIQUE (column1) USING INDEX TABLESPACE regress_tblspace;
ALTER TABLE t ADD CONSTRAINT pk PRIMARY KEY USING INDEX "My Index";
ALTER TABLE t ADD UNIQUE USING INDEX idx DEFERRABLE INITIALLY DEFERRED;
CREATE TABLESPACE "My Space" OWNER regress_user LOCATION '/tmp' WITH (random_page_cost = 3, seq_page_cost = '1.5');
ALTER TABLESPACE "My Space" SET (random_page_cost = 1.5, effective_io_concurrency = 2);
ALTER TABLESPACE "My Space" RESET (random_page_cost);
ALTER TABLESPACE "My Space" SET ("Random_Page_Cost" = 2);
DROP TABLESPACE IF EXISTS "My Space";
