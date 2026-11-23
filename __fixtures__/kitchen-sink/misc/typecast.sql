-- Round-trip coverage for TypeCast syntax selection (#398).
SELECT CAST('(' AS text);
SELECT CAST('(-)' AS text);
SELECT CAST('-hello' AS text);
SELECT CAST("a(b" AS integer);

-- Unary minus outside a cast is distinct from a negative cast argument.
SELECT -1::integer;
SELECT (-1)::integer;
SELECT -1.5::numeric;
SELECT (-1.5)::numeric;
SELECT (-0.0)::numeric;
SELECT (-9223372036854775808)::integer;

SELECT (1 + 2)::integer;
SELECT length('abc')::integer;
SELECT 'x'::pg_catalog.bpchar;
SELECT 'x'::pg_catalog.bpchar(3);
SELECT 'x'::pg_catalog.bpchar[];
SELECT 'x'::bpchar;
SELECT 'x'::app.some_type;
