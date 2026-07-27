-- Deploy schemas/my_schema/procedures/plpgsql_constructs to pg
-- requires: schemas/my_schema/schema
-- made with mass-deploy

-- PL/pgSQL construct fixture: every PLpgSQL_stmt_* node type emitted by
-- generate:constructive (per scripts/scan-corpus.js), so the schema transform
-- and round-trip validation cover the real shapes we produce.
--
-- To add a new case: append SQL here (or add a new file in __fixtures__/input/)
-- and run `pnpm fixtures` to regenerate the golden output.

BEGIN;

CREATE FUNCTION my_schema.case_fn(
  n int
) RETURNS text AS $$BEGIN
  CASE
      WHEN n > 0 THEN
        RETURN my_schema.label_pos();
      WHEN n < 0 THEN
        PERFORM my_schema.note_neg();
        RETURN 'neg';
      ELSE
        RETURN 'zero';
  END CASE;
END$$ LANGUAGE plpgsql;

CREATE FUNCTION my_schema.simple_case(
  n int
) RETURNS text AS $$BEGIN
  CASE n
      WHEN 1 THEN
        RETURN my_schema.one();
      WHEN 2 THEN
        RETURN 'two';
      ELSE
        RETURN 'many';
  END CASE;
END$$ LANGUAGE plpgsql;

CREATE FUNCTION my_schema.while_fn() RETURNS int AS $$DECLARE
  i int := 0;
  total int := 0;
BEGIN
  WHILE i < ((SELECT count(*)
    FROM my_schema.users)) LOOP
      total := total + 1;
      i := i + 1;
  END LOOP;
  RETURN total;
END$$ LANGUAGE plpgsql;

CREATE FUNCTION my_schema.loop_fn() RETURNS int AS $$DECLARE
  i int := 0;
BEGIN
  LOOP
      i := i + 1;
      EXIT WHEN i >= ((SELECT count(*)
        FROM my_schema.users));
  END LOOP;
  RETURN i;
END$$ LANGUAGE plpgsql;

CREATE FUNCTION my_schema.foreach_fn(
  arr int[]
) RETURNS int AS $$DECLARE
  x int;
  total int := 0;
BEGIN
  FOREACH x IN ARRAY arr LOOP
      total := total + x;
      PERFORM my_schema.track(x);
  END LOOP;
  RETURN total;
END$$ LANGUAGE plpgsql;

CREATE FUNCTION my_schema.continue_fn() RETURNS int AS $$DECLARE
  i int := 0;
  total int := 0;
BEGIN
  FOR i IN 1..10 LOOP
      CONTINUE WHEN (i % 2) = 0;
      total := total + ((SELECT count(*)
        FROM my_schema.users
        WHERE
          id = i));
  END LOOP;
  RETURN total;
END$$ LANGUAGE plpgsql;

CREATE FUNCTION my_schema.rn_out(
  OUT x int,
  OUT y int
) RETURNS SETOF record AS $$BEGIN
  FOR x IN SELECT g
  FROM my_schema.gs LOOP
      y := x * 2;
      RETURN NEXT;
  END LOOP;
END$$ LANGUAGE plpgsql;

CREATE FUNCTION my_schema.diag_fn() RETURNS text AS $$DECLARE
  msg text;
BEGIN
  PERFORM my_schema.might_fail();
  RETURN 'ok';
EXCEPTION
  WHEN others THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    PERFORM my_schema.log_err(msg);
    RETURN msg;
END$$ LANGUAGE plpgsql;

CREATE PROCEDURE my_schema.do_work(
  n int
) AS $$BEGIN
  PERFORM my_schema.track(n);
END$$ LANGUAGE plpgsql;

CREATE FUNCTION my_schema.call_fn() RETURNS void AS $$BEGIN
  CALL my_schema.do_work(1);
END$$ LANGUAGE plpgsql;

CALL my_schema.do_work(2);

CREATE FUNCTION my_schema.cursor_args_fn() RETURNS void AS $$DECLARE
  c CURSOR (key int) FOR SELECT *
  FROM my_schema.users
  WHERE
    id = key;
  r record;
BEGIN
  OPEN c (42);
  FETCH FROM c INTO r;
  CLOSE c;
END$$ LANGUAGE plpgsql;

CREATE FUNCTION my_schema.raise_sqlstate_fn() RETURNS void AS $$BEGIN
  IF NOT (EXISTS (SELECT 1
    FROM my_schema.users)) THEN
      RAISE EXCEPTION SQLSTATE '22012';
  END IF;
END$$ LANGUAGE plpgsql;

COMMIT;