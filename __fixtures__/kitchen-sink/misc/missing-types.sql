-- https://github.com/constructive-io/pgsql-parser/issues/219
ALTER PUBLICATION "my_publication" OWNER TO "postgres";

-- Missing ObjectType cases for AlterOwnerStmt testing
-- OBJECT_ACCESS_METHOD
-- ALTER ACCESS METHOD my_access_method OWNER TO new_owner;

-- OBJECT_AMOP (operator in operator family)
ALTER OPERATOR FAMILY my_opfamily USING btree OWNER TO new_owner;

-- OBJECT_AMPROC (procedure in operator family)
ALTER OPERATOR CLASS my_opclass USING btree OWNER TO new_owner;

-- OBJECT_ATTRIBUTE (attribute of composite type)
-- ALTER TYPE my_composite_type ATTRIBUTE my_attribute OWNER TO new_owner;

-- OBJECT_CAST
-- ALTER CAST (text AS integer) OWNER TO new_owner;

-- OBJECT_COLUMN (column of composite type)
-- ALTER TYPE my_composite_type ATTRIBUTE my_column OWNER TO new_owner;

-- OBJECT_DEFAULT (default value - typically not alterable via OWNER TO, but included for completeness)
-- Note: Defaults don't have owners, this may not be valid SQL

-- OBJECT_DEFACL (default ACL - typically not alterable via OWNER TO)
-- Note: Default ACLs don't have owners, this may not be valid SQL

-- OBJECT_DOMCONSTRAINT
-- ALTER DOMAIN my_domain CONSTRAINT my_constraint OWNER TO new_owner;

-- -- OBJECT_EXTENSION
-- ALTER EXTENSION hstore OWNER TO new_owner;
ALTER EXTENSION hstore UPDATE TO '2.0';
ALTER EXTENSION hstore SET SCHEMA utils;
ALTER EXTENSION hstore ADD FUNCTION populate_record(anyelement, hstore);

-- -- OBJECT_FOREIGN_TABLE
ALTER FOREIGN TABLE my_foreign_table OWNER TO new_owner;

-- -- OBJECT_LARGEOBJECT
ALTER LARGE OBJECT 12345 OWNER TO new_owner;

-- -- OBJECT_MATVIEW
ALTER MATERIALIZED VIEW my_matview OWNER TO new_owner;

-- -- OBJECT_POLICY
-- ALTER POLICY my_policy ON my_table OWNER TO new_owner;
-- ALTER POLICY policy_name ON table_name OWNER TO { new_owner | CURRENT_ROLE | CURRENT_USER | SESSION_USER };

-- -- OBJECT_PUBLICATION_NAMESPACE (publication for schema)
ALTER PUBLICATION my_publication OWNER TO new_owner;

-- -- OBJECT_ROUTINE (generic routine - function or procedure)
ALTER FUNCTION my_function(integer) OWNER TO new_owner;

-- -- OBJECT_RULE
-- ALTER RULE my_rule ON my_table OWNER TO new_owner;

-- -- OBJECT_SUBSCRIPTION
ALTER SUBSCRIPTION my_subscription OWNER TO new_owner;

-- -- OBJECT_STATISTIC_EXT
ALTER STATISTICS my_statistics OWNER TO new_owner;

-- -- OBJECT_TABCONSTRAINT
-- ALTER TABLE my_table CONSTRAINT my_constraint OWNER TO new_owner;

-- -- OBJECT_TABLESPACE
ALTER TABLESPACE my_tablespace OWNER TO new_owner;

-- -- OBJECT_TRANSFORM
-- ALTER TRANSFORM FOR hstore LANGUAGE plpgsql OWNER TO new_owner;

-- -- OBJECT_TRIGGER
-- ALTER TRIGGER my_trigger ON my_table OWNER TO new_owner;

-- -- OBJECT_TSPARSER
-- ALTER TEXT SEARCH PARSER my_parser OWNER TO new_owner;

-- -- OBJECT_TSTEMPLATE
-- ALTER TEXT SEARCH TEMPLATE my_template OWNER TO new_owner;

-- -- OBJECT_USER_MAPPING
-- ALTER USER MAPPING FOR my_user SERVER my_server OWNER TO new_owner;