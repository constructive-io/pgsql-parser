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
