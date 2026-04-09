-- Active users view
CREATE VIEW app.active_users AS
  SELECT id, username, created_at
  FROM app.users
  WHERE created_at > now() - interval '90 days';

-- Audit trigger function
CREATE FUNCTION app.audit_trigger() RETURNS trigger AS $$
BEGIN
  INSERT INTO app.audit_log (table_name, action, row_id)
  VALUES (TG_TABLE_NAME, TG_OP, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to users table
CREATE TRIGGER users_audit
  AFTER INSERT OR UPDATE ON app.users
  FOR EACH ROW
  EXECUTE FUNCTION app.audit_trigger();
