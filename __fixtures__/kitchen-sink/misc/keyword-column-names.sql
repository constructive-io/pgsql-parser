-- Keyword column names that can conflict with lexer lookahead before a type
CREATE TABLE t ("without" time);
CREATE TABLE t ("nulls" first, "format" json, "with" time);
CREATE TABLE t ("nulls" last[]);
ALTER TABLE t ADD COLUMN "without" time(3) with time zone;
SELECT * FROM XMLTABLE('/r' PASSING doc COLUMNS "without" time PATH 'x');
CREATE FUNCTION f() RETURNS TABLE ("without" time) LANGUAGE sql AS $$SELECT NULL::time$$;
