-- Fixtures to test schema rename traversal
-- These exercise complex scenarios with multiple schema references across different contexts

-- Test 1: Function with schema-qualified table references in SELECT
CREATE FUNCTION app_public.get_user_stats(p_user_id int)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  total_count int;
BEGIN
  SELECT count(*) INTO total_count
  FROM app_public.users u
  JOIN app_public.orders o ON o.user_id = u.id
  WHERE u.id = p_user_id;
  RETURN total_count;
END$$;

-- Test 2: Trigger function with INSERT into schema-qualified table
CREATE FUNCTION app_public.audit_changes()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO app_public.audit_log (table_name, operation, old_data, new_data, changed_at)
  VALUES (TG_TABLE_NAME, TG_OP, to_json(OLD), to_json(NEW), now());
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END$$;

-- Test 3: Function with UPDATE to schema-qualified table
CREATE FUNCTION app_public.update_user_status(p_user_id int, p_status text)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE app_public.users
  SET status = p_status, updated_at = now()
  WHERE id = p_user_id;
  
  INSERT INTO app_public.status_history (user_id, status, changed_at)
  VALUES (p_user_id, p_status, now());
END$$;

-- Test 4: Function with DELETE from schema-qualified table
CREATE FUNCTION app_public.cleanup_old_sessions(p_days int)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM app_public.sessions
  WHERE created_at < now() - (p_days || ' days')::interval;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END$$;

-- Test 5: SETOF function with RETURN QUERY and schema-qualified tables
CREATE FUNCTION app_public.get_active_orders(p_status text)
RETURNS SETOF int
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    SELECT o.id
    FROM app_public.orders o
    JOIN app_public.users u ON u.id = o.user_id
    WHERE o.status = p_status
      AND u.is_active = true;
  RETURN;
END$$;

-- Test 6: Function with schema-qualified function calls in expressions
CREATE FUNCTION app_public.calculate_order_total(p_order_id int)
RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE
  subtotal numeric;
  tax_amount numeric;
  discount numeric;
BEGIN
  SELECT sum(quantity * price) INTO subtotal
  FROM app_public.order_items
  WHERE order_id = p_order_id;
  
  tax_amount := app_public.get_tax_rate() * subtotal;
  discount := app_public.get_discount(p_order_id);
  
  RETURN subtotal + tax_amount - discount;
END$$;

-- Test 7: Function with multiple schema references in complex query
CREATE FUNCTION app_public.get_user_dashboard(p_user_id int)
RETURNS TABLE(metric_name text, metric_value numeric)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    SELECT 'total_orders'::text, count(*)::numeric
    FROM app_public.orders
    WHERE user_id = p_user_id
    UNION ALL
    SELECT 'total_spent'::text, coalesce(sum(total), 0)::numeric
    FROM app_public.orders
    WHERE user_id = p_user_id
    UNION ALL
    SELECT 'active_subscriptions'::text, count(*)::numeric
    FROM app_public.subscriptions
    WHERE user_id = p_user_id AND status = 'active';
  RETURN;
END$$;

-- Test 8: Trigger function with conditional logic and multiple tables
CREATE FUNCTION app_public.sync_user_profile()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  profile_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM app_public.profiles WHERE user_id = NEW.id
  ) INTO profile_exists;
  
  IF NOT profile_exists THEN
    INSERT INTO app_public.profiles (user_id, created_at)
    VALUES (NEW.id, now());
  ELSE
    UPDATE app_public.profiles
    SET updated_at = now()
    WHERE user_id = NEW.id;
  END IF;
  
  PERFORM app_public.notify_profile_change(NEW.id);
  RETURN NEW;
END$$;

-- Test 9: Function with CTE and schema-qualified references
CREATE FUNCTION app_public.get_top_customers(p_limit int)
RETURNS SETOF int
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    WITH customer_totals AS (
      SELECT user_id, sum(total) as total_spent
      FROM app_public.orders
      WHERE status = 'completed'
      GROUP BY user_id
    )
    SELECT ct.user_id
    FROM customer_totals ct
    JOIN app_public.users u ON u.id = ct.user_id
    WHERE u.is_active = true
    ORDER BY ct.total_spent DESC
    LIMIT p_limit;
  RETURN;
END$$;

-- Test 10: Function with subquery in WHERE clause
CREATE FUNCTION app_public.get_users_with_orders()
RETURNS SETOF int
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    SELECT u.id
    FROM app_public.users u
    WHERE EXISTS (
      SELECT 1 FROM app_public.orders o
      WHERE o.user_id = u.id
    );
  RETURN;
END$$;

-- Test 11: Function referencing multiple schemas
CREATE FUNCTION app_public.cross_schema_report(p_date date)
RETURNS TABLE(source text, count bigint)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    SELECT 'public_users'::text, count(*)
    FROM app_public.users
    WHERE created_at::date = p_date
    UNION ALL
    SELECT 'private_logs'::text, count(*)
    FROM app_private.activity_logs
    WHERE logged_at::date = p_date
    UNION ALL
    SELECT 'internal_metrics'::text, count(*)
    FROM app_internal.metrics
    WHERE recorded_at::date = p_date;
  RETURN;
END$$;

-- Test 12: Procedure with schema-qualified references
CREATE PROCEDURE app_public.process_batch(p_batch_id int)
LANGUAGE plpgsql AS $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM app_public.batch_items
    WHERE batch_id = p_batch_id
  LOOP
    INSERT INTO app_public.processed_items (item_id, processed_at)
    VALUES (item.id, now());
    
    UPDATE app_public.batch_items
    SET status = 'processed'
    WHERE id = item.id;
  END LOOP;
  
  UPDATE app_public.batches
  SET status = 'completed', completed_at = now()
  WHERE id = p_batch_id;
END$$;
