import { loadModule } from 'plpgsql-parser';

import { SchemaRouter, transformSql, transformSqlStatement } from '../src';

beforeAll(async () => {
  await loadModule();
});

const MAPPING = new Map([
  ['my-schema', 'my_schema'],
  ['other-schema', 'other_schema']
]);

function run(sql: string, mapping: Map<string, string> | SchemaRouter = MAPPING): string {
  return transformSql(sql, mapping).content;
}

describe('object-identity casts', () => {
  it('routes a bare schema name through ::regnamespace', () => {
    expect(run(`SELECT assert_schema('my-schema'::regnamespace);`))
      .toContain(`CAST('my_schema' AS regnamespace)`);
  });

  it('routes the qualifier of ::regclass', () => {
    expect(run(`SELECT assert_table('my-schema.users'::regclass);`))
      .toContain(`CAST('my_schema.users' AS regclass)`);
  });

  it('routes ::regprocedure and keeps the argument list', () => {
    expect(run(`SELECT assert_function('my-schema.fn(uuid, text)'::regprocedure);`))
      .toContain(`CAST('my_schema.fn(uuid, text)' AS regprocedure)`);
  });

  it('routes a schema-qualified argument type', () => {
    expect(
      run(`SELECT assert_function('my-schema.fn("other-schema".row_t)'::regprocedure);`)
    ).toContain(`CAST('my_schema.fn("other_schema".row_t)' AS regprocedure)`);
  });

  it('routes an argument type under an unqualified function name', () => {
    expect(
      run(`SELECT assert_function('fn("other-schema".row_t)'::regprocedure);`)
    ).toContain(`CAST('fn("other_schema".row_t)' AS regprocedure)`);
  });

  it('routes ::regproc', () => {
    expect(run(`SELECT assert_trigger('my-schema.users'::regclass, 'stamps', 'other-schema.tg'::regproc);`))
      .toContain(`CAST('other_schema.tg' AS regproc)`);
  });

  it('routes ::regtype', () => {
    expect(run(`SELECT CAST('my-schema.status'::regtype AS text);`))
      .toContain(`CAST('my_schema.status' AS regtype)`);
  });

  it('leaves an unqualified identity alone (search_path resolves it)', () => {
    expect(run(`SELECT assert_table('users'::regclass);`)).toContain(`CAST('users' AS regclass)`);
  });

  it('leaves an unmapped schema alone', () => {
    expect(run(`SELECT assert_schema('stamps'::regnamespace);`))
      .toContain(`CAST('stamps' AS regnamespace)`);
  });

  it('quotes a target name that is not a bare identifier', () => {
    const mapping = new Map([['my_schema', 'my-schema']]);
    expect(run(`SELECT assert_schema('my_schema'::regnamespace);`, mapping))
      .toContain(`CAST('"my-schema"' AS regnamespace)`);
    expect(run(`SELECT assert_table('my_schema.users'::regclass);`, mapping))
      .toContain(`CAST('"my-schema".users' AS regclass)`);
  });

  it('reads an already-quoted operand', () => {
    expect(run(`SELECT assert_table('"my-schema".users'::regclass);`))
      .toContain(`CAST('my_schema.users' AS regclass)`);
  });

  it('routes a pg_catalog-qualified cast', () => {
    expect(run(`SELECT assert_schema('my-schema'::pg_catalog.regnamespace);`))
      .toContain(`'my_schema'`);
  });

  it('does not treat a non-identity cast as a reference', () => {
    expect(run(`SELECT 'my-schema'::text;`)).toContain(`'my-schema'::text`);
  });

  it('routes each identity exactly once under a cyclic mapping', () => {
    const swap = new Map([['a', 'b'], ['b', 'a']]);
    const out = transformSqlStatement(
      `SELECT assert_schema('a'::regnamespace), assert_table('a.users'::regclass);`,
      swap
    ).sql;
    expect(out).toContain(`CAST('b' AS regnamespace)`);
    expect(out).toContain(`CAST('b.users' AS regclass)`);
  });

  it('applies object-level routes to a qualified identity', () => {
    const router = new SchemaRouter({
      'my-schema': { schema: 'my_schema', relations: { users: 'people_schema' } }
    });
    const out = run(
      `SELECT assert_table('my-schema.users'::regclass), assert_table('my-schema.orders'::regclass);`,
      router
    );
    expect(out).toContain(`CAST('people_schema.users' AS regclass)`);
    expect(out).toContain(`CAST('my_schema.orders' AS regclass)`);
  });

  it('rebinds an object route that renames', () => {
    const router = new SchemaRouter({
      'my-schema': { functions: { uid: { schema: null, name: 'current_user_id' } } }
    });
    expect(run(`SELECT assert_function('my-schema.uid(uuid)'::regprocedure);`, router))
      .toContain(`CAST('current_user_id(uuid)' AS regprocedure)`);
  });

  it('routes identities inside a DO body', () => {
    const sql = `DO $$ BEGIN PERFORM 'my-schema.users'::regclass; END $$;`;
    expect(run(sql)).toContain('my_schema.users');
  });
});
