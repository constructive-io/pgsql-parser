CREATE FUNCTION sum_to_n(n integer) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    total integer := 0;
    i integer;
BEGIN
    FOR i IN 1..n LOOP
        total := total + i;
    END LOOP;
    RETURN total;
END;
$$
