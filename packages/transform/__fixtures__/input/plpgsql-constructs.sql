-- Deploy schemas/my-schema/procedures/plpgsql_constructs to pg
-- requires: schemas/my-schema/schema
-- made with mass-deploy

-- PL/pgSQL construct fixture: every PLpgSQL_stmt_* node type emitted by
-- generate:constructive (per scripts/scan-corpus.js), so the schema transform
-- and round-trip validation cover the real shapes we produce.
--
-- To add a new case: append SQL here (or add a new file in __fixtures__/input/)
-- and run `pnpm fixtures` to regenerate the golden output.

BEGIN;

-- 1. Searched CASE (PLpgSQL_stmt_case / PLpgSQL_case_when)
CREATE FUNCTION "my-schema".case_fn(n int) RETURNS text AS $$
BEGIN
  CASE
    WHEN n > 0 THEN
      RETURN "my-schema".label_pos();
    WHEN n < 0 THEN
      PERFORM "my-schema".note_neg();
      RETURN 'neg';
    ELSE
      RETURN 'zero';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 2. Simple CASE with a test expression
CREATE FUNCTION "my-schema".simple_case(n int) RETURNS text AS $$
BEGIN
  CASE n
    WHEN 1 THEN RETURN "my-schema".one();
    WHEN 2 THEN RETURN 'two';
    ELSE RETURN 'many';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 3. WHILE loop (PLpgSQL_stmt_while)
CREATE FUNCTION "my-schema".while_fn() RETURNS int AS $$
DECLARE
  i int := 0;
  total int := 0;
BEGIN
  WHILE i < (SELECT count(*) FROM "my-schema".users) LOOP
    total := total + 1;
    i := i + 1;
  END LOOP;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- 4. Bare LOOP with EXIT WHEN (PLpgSQL_stmt_loop / PLpgSQL_stmt_exit)
CREATE FUNCTION "my-schema".loop_fn() RETURNS int AS $$
DECLARE
  i int := 0;
BEGIN
  LOOP
    i := i + 1;
    EXIT WHEN i >= (SELECT count(*) FROM "my-schema".users);
  END LOOP;
  RETURN i;
END;
$$ LANGUAGE plpgsql;

-- 5. FOREACH ... IN ARRAY (PLpgSQL_stmt_foreach_a)
CREATE FUNCTION "my-schema".foreach_fn(arr int[]) RETURNS int AS $$
DECLARE
  x int;
  total int := 0;
BEGIN
  FOREACH x IN ARRAY arr LOOP
    total := total + x;
    PERFORM "my-schema".track(x);
  END LOOP;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- 6. CONTINUE inside a loop (PLpgSQL_stmt_exit, is_exit = false)
CREATE FUNCTION "my-schema".continue_fn() RETURNS int AS $$
DECLARE
  i int := 0;
  total int := 0;
BEGIN
  FOR i IN 1..10 LOOP
    CONTINUE WHEN i % 2 = 0;
    total := total + (SELECT count(*) FROM "my-schema".users WHERE id = i);
  END LOOP;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- 7. RETURN NEXT bare / OUT-parameter form (PLpgSQL_stmt_return_next).
--      This is the only RETURN NEXT shape the generated corpus emits.
CREATE FUNCTION "my-schema".rn_out(OUT x int, OUT y int) RETURNS SETOF record AS $$
BEGIN
  FOR x IN SELECT g FROM "my-schema".gs LOOP
    y := x * 2;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 8. Nested EXCEPTION block with GET STACKED DIAGNOSTICS
CREATE FUNCTION "my-schema".diag_fn() RETURNS text AS $$
DECLARE
  msg text;
BEGIN
  PERFORM "my-schema".might_fail();
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  PERFORM "my-schema".log_err(msg);
  RETURN msg;
END;
$$ LANGUAGE plpgsql;

-- 9. CALL of a schema-qualified procedure (CallStmt), both inside a
--      PL/pgSQL body (PLpgSQL_stmt_call) and at the top level
CREATE PROCEDURE "my-schema".do_work(n int) AS $$
BEGIN
  PERFORM "my-schema".track(n);
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "my-schema".call_fn() RETURNS void AS $$
BEGIN
  CALL "my-schema".do_work(1);
END;
$$ LANGUAGE plpgsql;

CALL "my-schema".do_work(2);

-- 10. Bound cursor with explicit arguments (deparser fix: pgsql-parser #306)
CREATE FUNCTION "my-schema".cursor_args_fn() RETURNS void AS $$
DECLARE
  c CURSOR (key int) FOR SELECT * FROM "my-schema".users WHERE id = key;
  r record;
BEGIN
  OPEN c(42);
  FETCH c INTO r;
  CLOSE c;
END;
$$ LANGUAGE plpgsql;

-- 11. RAISE with a SQLSTATE condition code (deparser fix: pgsql-parser #306)
CREATE FUNCTION "my-schema".raise_sqlstate_fn() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "my-schema".users) THEN
    RAISE SQLSTATE '22012';
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;
