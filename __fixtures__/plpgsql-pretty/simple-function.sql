CREATE FUNCTION simple_add(a integer, b integer) RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN a + b;
END;
$$
