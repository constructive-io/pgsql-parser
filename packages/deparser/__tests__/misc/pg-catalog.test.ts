import { expectParseDeparse } from '../../test-utils';

it('should format pg_catalog.char with pretty option enabled', async () => {
  const sql = `
CREATE TABLE dashboard_jobs.jobs (
  id bigserial PRIMARY KEY,
  queue_name text DEFAULT CAST(public.gen_random_uuid() AS text),
  task_identifier text NOT NULL,
  payload pg_catalog.json DEFAULT '{}'::json NOT NULL,
  priority int DEFAULT 0 NOT NULL,
  run_at timestamptz DEFAULT now() NOT NULL,
  attempts int DEFAULT 0 NOT NULL,
  max_attempts int DEFAULT 25 NOT NULL,
  key text,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  CHECK (length(key) < 513),
  CHECK (length(task_identifier) < 127),
  CHECK (max_attempts > 0),
  CHECK (length(queue_name) < 127),
  CHECK (length(locked_by) > 3),
  UNIQUE (key)
);
    `;
  const result = await expectParseDeparse(sql, { pretty: true });
  expect(result).toMatchSnapshot();
});
