CREATE OR REPLACE FUNCTION app_public.big_kitchen_sink(
  p_org_id           uuid,
  p_user_id          uuid,
  p_from_ts          timestamptz DEFAULT now() - interval '30 days',
  p_to_ts            timestamptz DEFAULT now(),
  p_min_total        numeric     DEFAULT 0,
  p_max_rows         int         DEFAULT 250,
  p_currency         text        DEFAULT 'USD',
  p_apply_discount   boolean     DEFAULT true,
  p_discount_rate    numeric     DEFAULT 0.05,  -- 5%
  p_tax_rate         numeric     DEFAULT 0.0875,
  p_round_to         int         DEFAULT 2,
  p_note             text        DEFAULT NULL,
  p_lock             boolean     DEFAULT false,
  p_debug            boolean     DEFAULT false
)
RETURNS TABLE (
  org_id             uuid,
  user_id            uuid,
  period_from        timestamptz,
  period_to          timestamptz,
  orders_scanned     int,
  orders_upserted    int,
  gross_total        numeric,
  discount_total     numeric,
  tax_total          numeric,
  net_total          numeric,
  avg_order_total    numeric,
  top_sku            text,
  top_sku_qty        bigint,
  message            text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_orders_scanned   int := 0;
  v_orders_upserted  int := 0;
  v_gross            numeric := 0;
  v_discount         numeric := 0;
  v_tax              numeric := 0;
  v_net              numeric := 0;

  v_avg              numeric := 0;
  v_top_sku          text := NULL;
  v_top_sku_qty      bigint := 0;

  v_now              timestamptz := clock_timestamp();
  v_jitter           numeric := (random() - 0.5) * 0.02; -- +/- 1% jitter
  v_discount_rate    numeric := GREATEST(LEAST(p_discount_rate, 0.50), 0); -- cap at 50%
  v_tax_rate         numeric := GREATEST(LEAST(p_tax_rate, 0.30), 0);      -- cap at 30%
  v_min_total        numeric := COALESCE(p_min_total, 0);

  v_sql              text;
  v_rowcount         int := 0;

  v_lock_key         bigint := ('x' || substr(md5(p_org_id::text), 1, 16))::bit(64)::bigint;
BEGIN
  -- Basic param validation
  IF p_org_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_org_id and p_user_id are required';
  END IF;

  IF p_from_ts > p_to_ts THEN
    RAISE EXCEPTION 'p_from_ts (%) must be <= p_to_ts (%)', p_from_ts, p_to_ts;
  END IF;

  IF p_max_rows < 1 OR p_max_rows > 10000 THEN
    RAISE EXCEPTION 'p_max_rows out of range: %', p_max_rows;
  END IF;

  IF p_round_to < 0 OR p_round_to > 6 THEN
    RAISE EXCEPTION 'p_round_to out of range: %', p_round_to;
  END IF;

  IF p_lock THEN
    -- Optional: serialize per-org runs
    PERFORM pg_advisory_xact_lock(v_lock_key);
  END IF;

  IF p_debug THEN
    RAISE NOTICE 'big_kitchen_sink start=% org=% user=% from=% to=% min_total=%',
      v_now, p_org_id, p_user_id, p_from_ts, p_to_ts, v_min_total;
  END IF;

  /*
    Example “scan” query:
    - CTEs
    - aggregates
    - filtering
    - math
  */
  WITH base AS (
    SELECT
      o.id,
      o.total_amount::numeric AS total_amount,
      o.currency,
      o.created_at
    FROM app_public.app_order o
    WHERE o.org_id = p_org_id
      AND o.user_id = p_user_id
      AND o.created_at >= p_from_ts
      AND o.created_at <  p_to_ts
      AND o.total_amount::numeric >= v_min_total
      AND o.currency = p_currency
    ORDER BY o.created_at DESC
    LIMIT p_max_rows
  ),
  totals AS (
    SELECT
      count(*)::int AS orders_scanned,
      COALESCE(sum(total_amount), 0) AS gross_total,
      COALESCE(avg(total_amount), 0) AS avg_total
    FROM base
  )
  SELECT
    t.orders_scanned,
    t.gross_total,
    t.avg_total
  INTO
    v_orders_scanned,
    v_gross,
    v_avg
  FROM totals t;

  -- Discount math (with named params style internally, too)
  IF p_apply_discount THEN
    -- Add tiny jitter to demonstrate math; clamp final
    v_discount := round(v_gross * GREATEST(LEAST(v_discount_rate + v_jitter, 0.50), 0), p_round_to);
  ELSE
    v_discount := 0;
  END IF;

  -- Tax is computed on (gross - discount), typical pattern
  v_tax := round(GREATEST(v_gross - v_discount, 0) * v_tax_rate, p_round_to);

  -- Net with a couple extra math operations
  v_net := round((v_gross - v_discount + v_tax) * power(10::numeric, 0), p_round_to);

  /*
    Example “top sku” query:
    - joins
    - group by
    - order by
  */
  SELECT
    oi.sku,
    sum(oi.quantity)::bigint AS qty
  INTO v_top_sku, v_top_sku_qty
  FROM app_public.order_item oi
  JOIN app_public.app_order o ON o.id = oi.order_id
  WHERE o.org_id = p_org_id
    AND o.user_id = p_user_id
    AND o.created_at >= p_from_ts
    AND o.created_at <  p_to_ts
    AND o.currency = p_currency
  GROUP BY oi.sku
  ORDER BY qty DESC, oi.sku ASC
  LIMIT 1;

  /*
    Example mutation:
    - upsert
    - GET DIAGNOSTICS
  */
  INSERT INTO app_public.order_rollup (
    org_id,
    user_id,
    period_from,
    period_to,
    currency,
    orders_scanned,
    gross_total,
    discount_total,
    tax_total,
    net_total,
    avg_order_total,
    top_sku,
    top_sku_qty,
    note,
    updated_at
  )
  VALUES (
    p_org_id,
    p_user_id,
    p_from_ts,
    p_to_ts,
    p_currency,
    v_orders_scanned,
    v_gross,
    v_discount,
    v_tax,
    v_net,
    v_avg,
    v_top_sku,
    v_top_sku_qty,
    p_note,
    now()
  )
  ON CONFLICT (org_id, user_id, period_from, period_to, currency)
  DO UPDATE SET
    orders_scanned   = EXCLUDED.orders_scanned,
    gross_total      = EXCLUDED.gross_total,
    discount_total   = EXCLUDED.discount_total,
    tax_total        = EXCLUDED.tax_total,
    net_total        = EXCLUDED.net_total,
    avg_order_total  = EXCLUDED.avg_order_total,
    top_sku          = EXCLUDED.top_sku,
    top_sku_qty      = EXCLUDED.top_sku_qty,
    note             = COALESCE(EXCLUDED.note, app_public.order_rollup.note),
    updated_at       = now();

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  v_orders_upserted := v_rowcount;

  /*
    Example dynamic query:
    - pretend the user can pass a “filter table” name, etc.
    - show format() + USING
    Here we just demonstrate a safe dynamic query that counts rows from a known table.
  */
  v_sql := format(
    'SELECT count(*)::int FROM %I.%I WHERE org_id = $1 AND created_at >= $2 AND created_at < $3',
    'app_public',
    'app_order'
  );

  EXECUTE v_sql
    INTO v_rowcount
    USING p_org_id, p_from_ts, p_to_ts;

  IF p_debug THEN
    RAISE NOTICE 'dynamic count(app_order)=%', v_rowcount;
  END IF;

  -- Return a single row (RETURNS TABLE)
  org_id          := p_org_id;
  user_id         := p_user_id;
  period_from     := p_from_ts;
  period_to       := p_to_ts;
  orders_scanned  := v_orders_scanned;
  orders_upserted := v_orders_upserted;
  gross_total     := v_gross;
  discount_total  := v_discount;
  tax_total       := v_tax;
  net_total       := v_net;
  avg_order_total := round(v_avg, p_round_to);
  top_sku         := v_top_sku;
  top_sku_qty     := v_top_sku_qty;
  message         := format(
    'rollup ok: gross=%s discount=%s tax=%s net=%s (discount_rate=%s tax_rate=%s)',
    v_gross, v_discount, v_tax, v_net, v_discount_rate, v_tax_rate
  );

  RETURN NEXT;
  RETURN;

EXCEPTION
  WHEN unique_violation THEN
    -- example: if you had other inserts that might conflict
    RAISE NOTICE 'unique_violation: %', SQLERRM;
    RAISE;
  WHEN others THEN
    IF p_debug THEN
      RAISE NOTICE 'error: % (%:%)', SQLERRM, SQLSTATE, SQLERRM;
    END IF;
    RAISE;
END;
$$;

-- Example calls using named params (:=)
-- (Swap UUIDs with real values)
SELECT *
FROM app_public.big_kitchen_sink(
  p_org_id         := '00000000-0000-0000-0000-000000000001',
  p_user_id        := '00000000-0000-0000-0000-000000000002',
  p_from_ts        := now() - interval '7 days',
  p_to_ts          := now(),
  p_min_total      := 25,
  p_apply_discount := true,
  p_discount_rate  := 0.10,
  p_tax_rate       := 0.0925,
  p_round_to       := 2,
  p_note           := 'weekly rollup',
  p_lock           := true,
  p_debug          := true
);
