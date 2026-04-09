-- Function with multiple comment groups
CREATE FUNCTION process_order(p_order_id integer) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total numeric;
  v_status text;
BEGIN
  -- First, calculate the order total
  SELECT sum(amount) INTO v_total FROM order_items WHERE order_id = p_order_id;

  -- Then update the order status
  -- based on the total amount
  IF v_total > 1000 THEN
    v_status := 'premium';
  ELSE
    v_status := 'standard';
  END IF;

  -- Finally, record the result
  UPDATE orders SET status = v_status, total = v_total WHERE id = p_order_id;
END;
$$;
