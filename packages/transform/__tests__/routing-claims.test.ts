import { loadModule } from 'plpgsql-parser';

import { classifyStatements } from '../src/facts';
import { SchemaRouter } from '../src/router';
import { transformSqlStatement } from '../src/transform';

beforeAll(async () => {
  await loadModule();
});

const swap = new Map([
  ['a', 'b'],
  ['b', 'a']
]);

describe('single routing pass (claims)', () => {
  it('applies a cyclic schema mapping exactly once per site', () => {
    const cases: Array<[string, string]> = [
      ['CREATE TABLE a.t (id int);', 'CREATE TABLE b.t (\n  id int\n);'],
      ['SELECT * FROM a.t;', 'SELECT *\nFROM b.t;'],
      ['INSERT INTO a.t VALUES (1);', 'INSERT INTO b.t VALUES\n  (1);'],
      ['ALTER TABLE a.t ADD COLUMN c b.mytype;', 'ALTER TABLE b.t\n  ADD COLUMN c a.mytype;'],
      ['CREATE VIEW a.v AS SELECT * FROM b.t;', 'CREATE VIEW b.v AS SELECT * FROM a.t;'],
      ['SELECT a.f(NULL::b.tp);', 'SELECT b.f(CAST(NULL AS a.tp));'],
      ['DROP TABLE a.t;', 'DROP TABLE b.t;'],
      ['CREATE INDEX i ON a.t (c);', 'CREATE INDEX i ON b.t (c);'],
      [
        'CREATE TABLE t (o uuid REFERENCES a.pk (id));',
        'CREATE TABLE t (\n  o uuid REFERENCES b.pk (id)\n);'
      ]
    ];
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    for (const [input, expected] of cases) {
      expect(norm(transformSqlStatement(input, swap).sql)).toBe(norm(expected));
    }
  });

  it('swaps a two-schema module without leftover-validation errors', () => {
    const sql = [
      'CREATE TABLE a.users (id uuid PRIMARY KEY);',
      'CREATE TABLE b.posts (author uuid REFERENCES a.users (id));',
      'CREATE FUNCTION a.author_of(p uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT author FROM b.posts WHERE id = p $$;'
    ].join('\n');
    const out = sql
      .split('\n')
      .map(stmt => transformSqlStatement(stmt, swap).sql)
      .join('\n');
    expect(out).toContain('b.users');
    expect(out).toContain('a.posts');
    expect(out).toContain('b.author_of');
    expect(out).toContain('REFERENCES b.users');
  });

  it('statement-level namespace context wins over generic visitors', () => {
    // Only a *function* route for a.f exists. The DropStmt handler routes with
    // ns 'function'; the generic ObjectWithArgs visitor (ns 'unknown') must
    // not route it a second time.
    const router = new SchemaRouter({
      a: { functions: { f: 'fns' } }
    });
    expect(transformSqlStatement('DROP FUNCTION a.f(int);', router).sql.trim()).toBe(
      'DROP FUNCTION fns.f(int);'
    );
    expect(transformSqlStatement('ALTER FUNCTION a.f(int) OWNER TO u;', router).sql.trim()).toBe(
      'ALTER FUNCTION fns.f(int) OWNER TO u;'
    );
  });

  it('rebind with a cyclic name swap stays single-pass', () => {
    const router = new SchemaRouter({
      auth: { functions: { uid: { schema: null, name: 'current_user_id' } } }
    });
    expect(
      transformSqlStatement('SELECT auth.uid();', router).sql.trim()
    ).toBe('SELECT current_user_id();');
  });
});

describe('StatementFacts spans', () => {
  it('reports each statement source span verbatim', () => {
    const sql = `CREATE SCHEMA app;\nCREATE TABLE app.users (id uuid);\n\nSELECT 1;`;
    const facts = classifyStatements(sql);
    expect(facts).toHaveLength(3);
    for (const f of facts) {
      const text = sql.slice(f.span.start, f.span.start + f.span.len);
      expect(text.trim().length).toBeGreaterThan(0);
    }
    const [schema, table, select] = facts;
    expect(sql.slice(schema.span.start, schema.span.start + schema.span.len).trim()).toBe(
      'CREATE SCHEMA app'
    );
    expect(sql.slice(table.span.start, table.span.start + table.span.len).trim()).toBe(
      'CREATE TABLE app.users (id uuid)'
    );
    expect(sql.slice(select.span.start, select.span.start + select.span.len).trim()).toBe(
      'SELECT 1'
    );
  });

  it('covers the tail of the script for the final statement', () => {
    const sql = 'SELECT 1'; // no trailing semicolon
    const [f] = classifyStatements(sql);
    expect(f.span.start).toBe(0);
    expect(sql.slice(f.span.start, f.span.start + f.span.len)).toBe('SELECT 1');
  });
});
