-- Trigger function with comments in body
CREATE FUNCTION audit_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set the updated_at timestamp
  NEW.updated_at := now();

  -- Record the change in audit log
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, operation, old_data, new_data)
    VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW));
  END IF;

  RETURN NEW;
END;
$$;
