-- CREATE FOREIGN TABLE with schema-qualified column type and FDW options
CREATE FOREIGN TABLE public.foo (
 bar pg_catalog.varchar(50) 
) SERVER dummy OPTIONS (schema_name 'public', table_name 'foo');
