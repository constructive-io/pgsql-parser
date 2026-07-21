-- PG18: RETURNING OLD/NEW aliases (ReturningClause options)
INSERT INTO t (a) VALUES (1) RETURNING WITH (OLD AS o, NEW AS n) o.a, n.a;
UPDATE t SET a = 2 WHERE a = 1 RETURNING WITH (OLD AS prev, NEW AS next) prev.a AS before, next.a AS after;
DELETE FROM t WHERE a = 2 RETURNING WITH (OLD AS o) o.*;
MERGE INTO t USING s ON t.id = s.id WHEN MATCHED THEN UPDATE SET a = s.a RETURNING WITH (OLD AS o, NEW AS n) merge_action(), o.a, n.a;
INSERT INTO t (a) VALUES (1) RETURNING new.a;
UPDATE t SET a = 2 RETURNING old.a, new.a;

-- PG18: VIRTUAL generated columns
CREATE TABLE gtest (a int, b int GENERATED ALWAYS AS (a * 2) VIRTUAL);
CREATE TABLE gtest2 (a int, b int GENERATED ALWAYS AS (a * 2) STORED, c int GENERATED ALWAYS AS (a + 1) VIRTUAL);

-- PG18: NOT ENFORCED constraints
CREATE TABLE enf (a int, CONSTRAINT chk CHECK (a > 0) NOT ENFORCED);
CREATE TABLE enf2 (a int CHECK (a > 0) NOT ENFORCED);
ALTER TABLE enf ADD CONSTRAINT fk FOREIGN KEY (a) REFERENCES other (a) NOT ENFORCED;
ALTER TABLE enf ALTER CONSTRAINT chk NOT ENFORCED;
ALTER TABLE enf ALTER CONSTRAINT chk ENFORCED;

-- PG18: ALTER CONSTRAINT INHERIT / NO INHERIT
ALTER TABLE enf ALTER CONSTRAINT chk NO INHERIT;
ALTER TABLE enf ALTER CONSTRAINT chk INHERIT;
ALTER TABLE enf ALTER CONSTRAINT fk DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE enf ALTER CONSTRAINT fk NOT DEFERRABLE;

-- PG18: temporal primary keys / unique WITHOUT OVERLAPS and PERIOD foreign keys
CREATE TABLE temporal_rng (id int4range, valid_at daterange, CONSTRAINT temporal_rng_pk PRIMARY KEY (id, valid_at WITHOUT OVERLAPS));
CREATE TABLE temporal_rng_uq (id int4range, valid_at daterange, CONSTRAINT temporal_rng_uq UNIQUE (id, valid_at WITHOUT OVERLAPS));
CREATE TABLE temporal_fk_rng2rng (id int4range, valid_at daterange, parent_id int4range, CONSTRAINT temporal_fk_rng2rng_fk FOREIGN KEY (parent_id, PERIOD valid_at) REFERENCES temporal_rng (id, PERIOD valid_at));
ALTER TABLE temporal_fk_rng2rng ADD CONSTRAINT temporal_fk_rng2rng_fk2 FOREIGN KEY (parent_id, PERIOD valid_at) REFERENCES temporal_rng (id, PERIOD valid_at) ON DELETE CASCADE;

-- PG18: named NOT NULL table constraints
CREATE TABLE nn (a int, CONSTRAINT a_not_null NOT NULL a);
ALTER TABLE nn ADD CONSTRAINT b_not_null NOT NULL a;
ALTER TABLE nn ADD NOT NULL a NOT VALID;
CREATE TABLE nn2 (a int, NOT NULL a NO INHERIT);
