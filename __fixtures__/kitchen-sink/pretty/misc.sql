-- 1. Deeply nested CTEs with joins and aggregation
WITH recent_orders AS (
  SELECT o.id, o.user_id, o.created_at
  FROM orders o
  WHERE o.created_at > NOW() - INTERVAL '30 days'
), high_value_orders AS (
  SELECT r.user_id, COUNT(*) AS order_count, SUM(oi.price * oi.quantity) AS total_spent
  FROM recent_orders r
  JOIN order_items oi ON r.id = oi.order_id
  GROUP BY r.user_id
)
SELECT u.id, u.name, h.total_spent
FROM users u
JOIN high_value_orders h ON u.id = h.user_id
WHERE h.total_spent > 1000
ORDER BY h.total_spent DESC;

-- 2. Complex SELECT with window functions, FILTER, and GROUPING SETS
SELECT
  department,
  employee_id,
  COUNT(*) FILTER (WHERE status = 'active') OVER (PARTITION BY department) AS active_count,
  RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS salary_rank
FROM employee_status
GROUP BY GROUPING SETS ((department), (department, employee_id));

-- 3. Query with JSON accessors, lateral joins, and functions
SELECT u.id, u.name, j.key, j.value
FROM users u,
LATERAL jsonb_each_text(u.preferences) AS j(key, value)
WHERE j.key LIKE 'notif_%' AND j.value::boolean = true;

-- 4. Use of EXISTS with nested correlated subqueries and CASE logic
SELECT p.id, p.title,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM reviews r
      WHERE r.product_id = p.id AND r.rating >= 4
    ) THEN 'Popular'
    ELSE 'Unrated'
  END AS status
FROM products p
WHERE p.archived = false;

-- 5. Inlined functions, CTEs, multi-level nesting with type casts
WITH logs AS (
  SELECT id, payload::json->>'event' AS event, (payload::json->>'ts')::timestamp AS ts
  FROM event_log
  WHERE ts > NOW() - INTERVAL '7 days'
)
SELECT event, COUNT(*) AS freq
FROM (
  SELECT DISTINCT event, ts::date AS event_day
  FROM logs
) d
GROUP BY event
ORDER BY freq DESC;

-- 6. A massive one for ya

SELECT 
  o.id AS order_id,
  u.name AS user_name,
  p.name AS product_name,
  s.status,
  sh.shipped_at,
  r.refund_amount
FROM orders o
JOIN users u 
  ON o.user_id = u.id
JOIN order_items oi 
  ON oi.order_id = o.id
JOIN products p 
  ON (
    (p.id = oi.product_id AND p.available = true)
    OR 
    (p.sku = oi.product_sku AND (p.discontinued = false OR p.replacement_id IS NOT NULL))
  )
LEFT JOIN shipping sh 
  ON (
    sh.order_id = o.id 
    AND (
      (sh.carrier = 'UPS' AND sh.tracking_number IS NOT NULL)
      OR 
      (sh.carrier = 'FedEx' AND sh.shipped_at > o.created_at + INTERVAL '1 day')
    )
  )
LEFT JOIN statuses s 
  ON s.id = o.status_id 
  AND (
    s.name != 'cancelled'
    OR (s.name = 'cancelled' AND s.updated_at > NOW() - INTERVAL '7 days')
  )
LEFT JOIN refunds r 
  ON r.order_id = o.id 
  AND (
    (r.status = 'approved' AND r.processed_at IS NOT NULL)
    OR 
    (r.status = 'pending' AND r.requested_at < NOW() - INTERVAL '14 days')
  )
WHERE o.created_at > NOW() - INTERVAL '90 days'
  AND u.active = true
  AND (
    s.status = 'shipped' 
    OR (
      s.status = 'processing' 
      AND EXISTS (
        SELECT 1 FROM order_notes n WHERE n.order_id = o.id AND n.note ILIKE '%expedite%'
      )
    )
  )
ORDER BY o.created_at DESC;

-- 7. A case

select (CASE 
WHEN ( n = 2 ) THEN ARRAY[ 'month' ]
WHEN ( n = 4 ) THEN ARRAY[ 'year' ]
WHEN ( n = 6 ) THEN ARRAY[ 'year', 'month' ]
WHEN ( n = 8 ) THEN ARRAY[ 'day' ]
WHEN ( n = 1024 ) THEN ARRAY[ 'hour' ]
WHEN ( n = 1032 ) THEN ARRAY[ 'day', 'hour' ]
WHEN ( n = 2048 ) THEN ARRAY[ 'minute' ]
WHEN ( n = 3072 ) THEN ARRAY[ 'hour', 'minute' ]
WHEN ( n = 3080 ) THEN ARRAY[ 'day', 'minute' ]
WHEN ( n = 4096 ) THEN ARRAY[ 'second' ]
WHEN ( n = 6144 ) THEN ARRAY[ 'minute', 'second' ]
WHEN ( n = 7168 ) THEN ARRAY[ 'hour', 'second' ]
WHEN ( n = 7176 ) THEN ARRAY[ 'day', 'second' ]
WHEN ( n = 32767 ) THEN ARRAY[]::text[]
END);

-- 8. A case

SELECT (
  CASE 
    WHEN n = 2 OR n = 3 THEN ARRAY['month', COALESCE(extra_label, 'unknown')]
    WHEN n IN (4, 5) THEN 
      CASE 
        WHEN is_leap_year THEN ARRAY['year', 'leap']
        ELSE ARRAY['year']
      END
    WHEN n = 6 THEN ARRAY['year', 'month', 'quarter']
    WHEN n = 8 THEN ARRAY['day', 'week', compute_label(n)]
    WHEN n = 1024 THEN ARRAY['hour', format('%s-hour', extra_label)]
    WHEN n = 1032 AND flag = true THEN ARRAY['day', 'hour', 'flagged']
    WHEN n BETWEEN 2048 AND 2049 THEN ARRAY['minute', 'tick']
    WHEN n = 3072 THEN ARRAY['hour', 'minute', current_setting('timezone')]
    WHEN n = 3080 THEN ARRAY['day', 'minute', to_char(now(), 'HH24:MI')]
    WHEN n IN (4096, 4097, 4098) THEN ARRAY['second', 'millisecond']
    WHEN n = 6144 THEN ARRAY['minute', 'second', CASE WHEN use_micro = true THEN 'microsecond' ELSE 'none' END]
    WHEN n = 7168 OR (n > 7170 AND n < 7180) THEN ARRAY['hour', 'second', 'buffered']
    WHEN n = 7176 THEN ARRAY['day', 'second', extra_info::text]
    WHEN n = 32767 THEN ARRAY[]::text[]
    ELSE ARRAY['undefined', 'unknown', 'fallback']
  END
);


-- 9. A case with select 

SELECT 
  user_id,
  (CASE 
    WHEN EXISTS (SELECT 1 FROM logins WHERE logins.user_id = users.user_id AND success = false) 
    THEN 'risky'
    ELSE 'safe'
  END) AS risk_status
FROM users;

-- 10. A case in where clause

SELECT * 
FROM orders
WHERE 
  status = (CASE 
              WHEN shipped_at IS NOT NULL THEN 'shipped'
              WHEN canceled_at IS NOT NULL THEN 'canceled'
              ELSE 'processing'
            END);

-- 11. A case in lateral join

SELECT *
FROM users u,
LATERAL (
  SELECT 
    (CASE 
      WHEN u.is_admin THEN 'admin_dashboard'
      ELSE 'user_dashboard'
    END) AS dashboard_view
) AS derived;

-- 12. A CASE used inside a scalar subquery in SELECT

SELECT 
  id,
  (SELECT 
     CASE 
       WHEN COUNT(*) > 5 THEN 'frequent'
       ELSE 'occasional'
     END
   FROM purchases p WHERE p.user_id = u.id) AS purchase_freq
FROM users u;

-- 13. A case in window function

SELECT 
  id,
  CASE 
    WHEN rank() OVER (ORDER BY score DESC) = 1 THEN 'top'
    ELSE 'normal'
  END AS tier
FROM players;

-- 14. A trigger

CREATE TRIGGER decrease_job_queue_count_on_delete 
 AFTER DELETE ON dashboard_jobs.jobs 
 FOR EACH ROW
 WHEN ( OLD.queue_name IS NOT NULL ) 
 EXECUTE PROCEDURE dashboard_jobs.tg_decrease_job_queue_count ();

-- 15. default privileges

ALTER DEFAULT PRIVILEGES IN SCHEMA dashboard_jobs 
 GRANT EXECUTE ON FUNCTIONS  TO administrator;

-- 16. grant execute on function

GRANT EXECUTE ON FUNCTION dashboard_private.uuid_generate_seeded_uuid TO PUBLIC;


-- https://github.com/constructive-io/pgsql-parser/issues/217
SELECT CAST(t.date AT TIME ZONE $$America/New_York$$ AS text)::date FROM tbl t;