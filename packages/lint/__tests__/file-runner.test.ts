import * as path from 'path';

import { filesAdapter, lintFiles, lintSource, lintSqlText, sqlTextAdapter } from '../src';

const FIXTURES = path.join(__dirname, '__fixtures__');

describe('lintSqlText (mixed source)', () => {
  const migration = `CREATE SCHEMA app_public;

CREATE TABLE app_public.users (id serial primary key);

CREATE FUNCTION app_public.dirty() RETURNS setof app_public.users
LANGUAGE sql
AS $$
  SELECT * FROM users
$$;`;

  it('lints only the function, not the surrounding DDL', async () => {
    const report = await lintSqlText(migration);
    expect(report.parseError).toBeUndefined();
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].ruleId).toBe('require-qualified-refs');
    expect(report.findings[0].code).toBe('C3');
  });

  it('re-anchors the finding to the absolute file line', async () => {
    const report = await lintSqlText(migration);
    // `SELECT * FROM users` is on line 8 of the source.
    expect(report.findings[0].line).toBe(8);
  });

  it('attributes the finding to the containing function', async () => {
    const report = await lintSqlText(migration);
    expect(report.findings[0].subject).toBe('app_public.dirty');
  });

  it('reports nothing for a file with no functions', async () => {
    const report = await lintSqlText('CREATE SCHEMA a; CREATE TABLE a.t (id int);');
    expect(report.findings).toHaveLength(0);
  });
});

describe('lintFiles', () => {
  it('reads a fixture file and finds only the dirty function', async () => {
    const reports = await lintFiles([path.join(FIXTURES, 'migration.sql')]);
    expect(reports).toHaveLength(1);
    const findings = reports[0].findings;
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('require-qualified-refs');
    expect(findings[0].subject).toBe('app_public.dirty');
  });

  it('scans a directory recursively for .sql files', async () => {
    const reports = await lintFiles([FIXTURES]);
    expect(reports.some((r) => r.file.endsWith('migration.sql'))).toBe(true);
  });
});

describe('lintSource (adapters)', () => {
  it('lints definitions from a sql-text adapter, grouped by file', async () => {
    const adapter = sqlTextAdapter(
      `CREATE FUNCTION app.f() RETURNS int LANGUAGE sql AS $$ SELECT * FROM users $$;`,
      'virtual.sql'
    );
    const reports = await lintSource(adapter);
    expect(reports).toHaveLength(1);
    expect(reports[0].file).toBe('virtual.sql');
    expect(reports[0].findings[0].ruleId).toBe('require-qualified-refs');
  });

  it('lints definitions from a files adapter', async () => {
    const reports = await lintSource(filesAdapter([path.join(FIXTURES, 'migration.sql')]));
    expect(reports.some((r) => r.file.endsWith('migration.sql'))).toBe(true);
  });
});

describe('multi-byte characters before a definition', () => {
  it('finds every rule after a non-ASCII comment', async () => {
    const [report] = await lintFiles([path.join(FIXTURES, 'multibyte.sql')]);
    expect(report.parseError).toBeUndefined();
    const byCode = Object.fromEntries(
      report.findings.map((f) => [f.code, { line: f.line, subject: f.subject }])
    );
    expect(byCode).toEqual({
      C1: { line: 7, subject: 'app_public.pinned' },
      C4: { line: 16, subject: 'app_public.dynamic' },
      C3: { line: 24, subject: 'app_public.dirty' }
    });
  });

  it('is byte-for-byte equivalent to the ASCII-folded source', async () => {
    const source = `-- → —\nCREATE FUNCTION f(x text) RETURNS void LANGUAGE plpgsql AS $$\nBEGIN\n  EXECUTE format('SELECT %s', x);\nEND;\n$$;`;
    const folded = await lintSqlText(source.replace('→', '->').replace('—', '-'));
    const report = await lintSqlText(source);
    expect(report.findings).toEqual(folded.findings);
    expect(report.findings.map((f) => [f.code, f.line])).toEqual([['C4', 4]]);
  });
});

describe('definitions that fail to parse', () => {
  it('surface as a finding instead of being dropped', async () => {
    const report = await lintSource(
      sqlTextAdapter(
        `CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$ BEGIN this is not plpgsql; END; $$;`,
        'bad.sql'
      )
    );
    expect(report).toHaveLength(1);
    expect(report[0].findings).toHaveLength(1);
    expect(report[0].findings[0]).toMatchObject({
      ruleId: 'parse-error',
      code: 'P0',
      severity: 'error',
      subject: 'f',
      line: 1
    });
  });
});
