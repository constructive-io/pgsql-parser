CREATE FUNCTION trigger_with_special_vars() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_at := now();
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.id IS DISTINCT FROM NEW.id THEN
            RAISE EXCEPTION 'IMMUTABLE_FIELD';
        END IF;
        NEW.updated_at := now();
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND';
    END IF;
    RETURN NEW;
END;
$$
