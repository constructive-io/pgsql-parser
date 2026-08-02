import { LINT_RULES, lintDefinition } from '../src';

function ruleIds(problems: { ruleId: string }[]): string[] {
  return [...new Set(problems.map((p) => p.ruleId))].sort();
}

describe('rule metadata', () => {
  it('exposes stable codes C1–C4', () => {
    const codes = LINT_RULES.map((r) => r.code).sort();
    expect(codes).toEqual(['C1', 'C2', 'C3', 'C4']);
  });

  it('only no-dynamic-sql requires a reason', () => {
    const required = LINT_RULES.filter((r) => r.reasonRequired).map((r) => r.id);
    expect(required).toEqual(['no-dynamic-sql']);
  });
});

describe('C1 no-set-search-path', () => {
  it('flags a SET search_path clause', async () => {
    const sql = `CREATE FUNCTION app.f() RETURNS int
LANGUAGE sql
SET search_path = app_public
AS $$ SELECT 1 $$;`;
    const { problems } = await lintDefinition(sql, 'sql');
    expect(ruleIds(problems)).toContain('no-set-search-path');
  });

  it('flags set_config(search_path) in a body', async () => {
    const sql = `CREATE FUNCTION app.f() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('search_path', 'app_public', true);
END;
$$;`;
    const { problems } = await lintDefinition(sql, 'plpgsql');
    expect(ruleIds(problems)).toContain('no-set-search-path');
  });

  it('passes a function that never sets search_path', async () => {
    const sql = `CREATE FUNCTION app.f() RETURNS int
LANGUAGE sql
AS $$ SELECT 1 $$;`;
    const { problems } = await lintDefinition(sql, 'sql');
    expect(ruleIds(problems)).not.toContain('no-set-search-path');
  });
});

describe('C2 no-variable-conflict', () => {
  it('flags a #variable_conflict directive', async () => {
    const sql = `CREATE FUNCTION app.f() RETURNS void
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  NULL;
END;
$$;`;
    const { problems } = await lintDefinition(sql, 'plpgsql');
    expect(ruleIds(problems)).toContain('no-variable-conflict');
  });

  it('does not run on a SQL-language function', async () => {
    const sql = `CREATE FUNCTION app.f() RETURNS int
LANGUAGE sql
AS $$ SELECT 1 $$;`;
    const { problems } = await lintDefinition(sql, 'sql');
    expect(ruleIds(problems)).not.toContain('no-variable-conflict');
  });
});

describe('C3 require-qualified-refs', () => {
  it('flags an unqualified relation reference', async () => {
    const sql = `CREATE FUNCTION app.f() RETURNS setof users
LANGUAGE sql
AS $$ SELECT * FROM users $$;`;
    const { problems } = await lintDefinition(sql, 'sql');
    expect(ruleIds(problems)).toContain('require-qualified-refs');
  });

  it('accepts a schema-qualified reference', async () => {
    const sql = `CREATE FUNCTION app.f() RETURNS setof app_public.users
LANGUAGE sql
AS $$ SELECT * FROM app_public.users $$;`;
    const { problems } = await lintDefinition(sql, 'sql');
    expect(ruleIds(problems)).not.toContain('require-qualified-refs');
  });

  it('does not flag a CTE name', async () => {
    const sql = `CREATE FUNCTION app.f() RETURNS int
LANGUAGE sql
AS $$
WITH recent AS (SELECT id FROM app_public.users)
SELECT count(*)::int FROM recent
$$;`;
    const { problems } = await lintDefinition(sql, 'sql');
    const c3 = problems.filter((p) => p.ruleId === 'require-qualified-refs');
    expect(c3.map((p) => (p.context as { relation: string }).relation)).not.toContain('recent');
  });
});

describe('C4 no-dynamic-sql', () => {
  const dynamic = `CREATE FUNCTION app.f(tbl text) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('DELETE FROM %I', tbl);
END;
$$;`;

  it('flags EXECUTE', async () => {
    const { problems } = await lintDefinition(dynamic, 'plpgsql');
    expect(ruleIds(problems)).toContain('no-dynamic-sql');
  });

  it('flags FOR … IN EXECUTE', async () => {
    const sql = `CREATE FUNCTION app.f(q text) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE r record;
BEGIN
  FOR r IN EXECUTE q LOOP
    NULL;
  END LOOP;
END;
$$;`;
    const { problems } = await lintDefinition(sql, 'plpgsql');
    expect(problems.some((p) => p.ruleId === 'no-dynamic-sql')).toBe(true);
  });

  it('a bare disable does not silence it (reason required)', async () => {
    const sql = `CREATE FUNCTION app.f(tbl text) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- pgsql-lint-disable-next-line no-dynamic-sql
  EXECUTE format('DELETE FROM %I', tbl);
END;
$$;`;
    const { problems, suppressed } = await lintDefinition(sql, 'plpgsql');
    expect(problems.some((p) => p.ruleId === 'no-dynamic-sql')).toBe(true);
    expect(problems.some((p) => p.context?.invalidSuppression === 'missing-reason')).toBe(true);
    expect(suppressed).toHaveLength(0);
  });

  it('a reasoned disable acknowledges it', async () => {
    const sql = `CREATE FUNCTION app.f(tbl text) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- pgsql-lint-disable-next-line no-dynamic-sql -- codegen: emitting DDL for a generated table
  EXECUTE format('DELETE FROM %I', tbl);
END;
$$;`;
    const { problems, suppressed } = await lintDefinition(sql, 'plpgsql');
    expect(problems.some((p) => p.ruleId === 'no-dynamic-sql')).toBe(false);
    expect(suppressed).toHaveLength(1);
    expect(suppressed[0].reason).toContain('codegen');
  });
});

describe('suppression scopes', () => {
  const unqualified = `CREATE FUNCTION app.f() RETURNS setof users
LANGUAGE sql
AS $$ SELECT * FROM users $$;`;

  it('disable-file silences across the whole definition', async () => {
    const sql = `-- pgsql-lint-disable-file require-qualified-refs -- legacy view, tracked separately
${unqualified}`;
    const { problems, suppressed } = await lintDefinition(sql, 'sql');
    expect(problems.some((p) => p.ruleId === 'require-qualified-refs')).toBe(false);
    expect(suppressed.some((p) => p.ruleId === 'require-qualified-refs')).toBe(true);
  });

  it('the safegres keyword is accepted by default', async () => {
    const sql = `-- safegres-disable-file require-qualified-refs -- legacy
${unqualified}`;
    const { problems } = await lintDefinition(sql, 'sql');
    expect(problems.some((p) => p.ruleId === 'require-qualified-refs')).toBe(false);
  });

  it('a narrowed keyword ignores the other brand', async () => {
    const sql = `-- safegres-disable-file require-qualified-refs -- legacy
${unqualified}`;
    const { problems } = await lintDefinition(sql, 'sql', undefined, { keyword: 'pgsql-lint' });
    expect(problems.some((p) => p.ruleId === 'require-qualified-refs')).toBe(true);
  });
});

describe('unparseable definitions', () => {
  it('produces no findings rather than throwing', async () => {
    const { problems, suppressed } = await lintDefinition('this is not sql at all', 'sql');
    expect(problems).toHaveLength(0);
    expect(suppressed).toHaveLength(0);
  });
});
