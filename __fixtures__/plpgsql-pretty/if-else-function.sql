CREATE FUNCTION check_value(val integer) RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    IF val > 100 THEN
        RETURN 'large';
    ELSIF val > 10 THEN
        RETURN 'medium';
    ELSE
        RETURN 'small';
    END IF;
END;
$$
