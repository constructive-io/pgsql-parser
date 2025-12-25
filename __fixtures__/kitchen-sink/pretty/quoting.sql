-- 1. Unquoted function name "float" (reserved keyword) - INPUT FORM
-- The deparser should quote this reserved keyword
CREATE FUNCTION faker.float(min double precision DEFAULT 0, max double precision DEFAULT 100) RETURNS double precision AS $EOFCODE$
BEGIN
  RETURN min + random() * (max - min);
END;
$EOFCODE$ LANGUAGE plpgsql;

-- 2. Quoted function name "float" - CANONICAL FORM (idempotence check)
CREATE FUNCTION faker."float"(min double precision DEFAULT 0, max double precision DEFAULT 100) RETURNS double precision AS $EOFCODE$
BEGIN
  RETURN min + random() * (max - min);
END;
$EOFCODE$ LANGUAGE plpgsql;

-- 3. Unquoted function name "interval" (reserved keyword) - INPUT FORM
CREATE FUNCTION faker.interval(min int, max int) RETURNS interval AS $EOFCODE$
BEGIN
  RETURN make_interval(secs => (min + floor(random() * (max - min + 1)))::int);
END;
$EOFCODE$ LANGUAGE plpgsql;

-- 4. Quoted function name "interval" - CANONICAL FORM (idempotence check)
CREATE FUNCTION faker."interval"(min int, max int) RETURNS interval AS $EOFCODE$
BEGIN
  RETURN make_interval(secs => (min + floor(random() * (max - min + 1)))::int);
END;
$EOFCODE$ LANGUAGE plpgsql;

-- 5. Unquoted function name "boolean" (reserved keyword) - INPUT FORM
CREATE FUNCTION faker.boolean() RETURNS boolean AS $EOFCODE$
BEGIN
  RETURN random() < 0.5;
END;
$EOFCODE$ LANGUAGE plpgsql;

-- 6. Quoted function name "boolean" - CANONICAL FORM (idempotence check)
CREATE FUNCTION faker."boolean"() RETURNS boolean AS $EOFCODE$
BEGIN
  RETURN random() < 0.5;
END;
$EOFCODE$ LANGUAGE plpgsql;

-- 7. pg_catalog.substring with quoted identifier - CANONICAL FORM
-- Note: SUBSTRING(value FROM 'pattern') SQL syntax gets deparsed to pg_catalog."substring"(value, 'pattern')
-- The SQL syntax form cannot be tested here due to AST round-trip differences (COERCE_SQL_SYNTAX vs COERCE_EXPLICIT_CALL)
CREATE DOMAIN origin AS text CHECK (value = pg_catalog."substring"(value, '^(https?://[^/]*)'));

-- 8. Type name quoting: json type should NOT be quoted (COL_NAME_KEYWORD in type position)
-- Type names follow a less strict quoting policy than standalone identifiers
SELECT '{"a":1}'::json;

-- 9. Type name quoting: jsonb type should NOT be quoted
SELECT '{"b":2}'::jsonb;

-- 10. Type name quoting: boolean type should NOT be quoted (TYPE_FUNC_NAME_KEYWORD in type position)
SELECT true::boolean;

-- 11. Type name quoting: interval type should NOT be quoted (TYPE_FUNC_NAME_KEYWORD in type position)
SELECT '1 day'::interval;

-- 12. Type name quoting: int type should NOT be quoted (COL_NAME_KEYWORD in type position)
SELECT 42::int;

-- 13. Type cast in INSERT VALUES - json type should NOT be quoted
INSERT INTO test_table (data) VALUES ('{"c":3}'::json);

-- 14. User-defined schema-qualified type with keyword name - should NOT quote the type name
-- This tests the bug where non-pg_catalog types use quoteIdentifier() for ALL parts
-- The type name 'json' is a COL_NAME_KEYWORD and should NOT be quoted in type position
SELECT '{"d":4}'::myschema.json;

-- 15. User-defined schema-qualified type with keyword name 'int' - should NOT quote
SELECT 100::custom.int;

-- 16. User-defined schema-qualified type with keyword name 'boolean' - should NOT quote
SELECT true::myapp.boolean;
