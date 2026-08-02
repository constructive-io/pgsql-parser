-- CREATE INDEX trailing-clause ordering: the grammar requires
-- ( params ) INCLUDE ... NULLS NOT DISTINCT WITH ... TABLESPACE ... WHERE ...
-- Ref: constructive-io/constructive-planning#1382
CREATE UNIQUE INDEX u1 ON t (a) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX u2 ON t (a, b) NULLS NOT DISTINCT WHERE c IS NULL;
CREATE UNIQUE INDEX u3 ON t (a) INCLUDE (b) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX u4 ON t (a) INCLUDE (b) NULLS NOT DISTINCT WITH (fillfactor = 70) WHERE c IS NULL;
CREATE UNIQUE INDEX u5 ON t (a) NULLS NOT DISTINCT WITH (fillfactor = 70) TABLESPACE pg_default WHERE c IS NULL;
CREATE UNIQUE INDEX u6 ON s.t (a, b) WITH (fillfactor = 70) WHERE c IS NULL;
CREATE UNIQUE INDEX u7 ON t (a) WHERE c IS NULL;
CREATE INDEX u8 ON t USING btree (a) WITH (fillfactor = 70) TABLESPACE pg_default WHERE c IS NULL;

CREATE UNIQUE INDEX platform_secrets_namespace_id_name_realm_idx
  ON "constructive-store-private".platform_secrets ( namespace_id, name, realm )
  NULLS NOT DISTINCT WHERE retired_at IS NULL;

CREATE UNIQUE INDEX secrets_database_id_namespace_id_name_realm_idx
  ON "constructive-store-private".secrets ( database_id, namespace_id, name, realm )
  NULLS NOT DISTINCT WHERE retired_at IS NULL;

-- table-constraint path, which already emitted NULLS NOT DISTINCT before the key list
ALTER TABLE t ADD CONSTRAINT c UNIQUE NULLS NOT DISTINCT (a, b);
CREATE TABLE nnd (a int, b int, UNIQUE NULLS NOT DISTINCT (a, b));
