import { loadModule } from 'plpgsql-parser';

import { restructureSql } from '../src/restructure';

beforeAll(async () => {
  await loadModule();
});

const ATOMIC = `
CREATE TABLE app.users ();
ALTER TABLE app.users ADD COLUMN id uuid;
ALTER TABLE app.users ADD COLUMN email text;
ALTER TABLE app.users ALTER COLUMN email SET NOT NULL;
ALTER TABLE app.users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE app.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
CREATE TABLE app.orders ();
ALTER TABLE app.orders ADD COLUMN id uuid;
ALTER TABLE app.orders ADD COLUMN user_id uuid;
ALTER TABLE app.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE app.orders ADD CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES app.users (id);
`;

describe('restructureSql — fold (object granularity)', () => {
  it('folds columns and same-table constraints into CREATE TABLE, keeps FKs separate', () => {
    const result = restructureSql(ATOMIC, { granularity: 'object' });
    expect(result.warnings).toEqual([]);
    expect(result.sql).toMatchSnapshot();
    // Columns, defaults, not-null, PKs folded; FK stays as ALTER TABLE.
    expect(result.sql).toContain('CREATE TABLE app.users');
    expect(result.sql).toContain('DEFAULT gen_random_uuid()');
    expect(result.sql).toContain('NOT NULL');
    expect(result.sql.match(/ALTER TABLE/g) ?? []).toHaveLength(1);
    expect(result.sql).toContain('FOREIGN KEY');
  });
});

describe('restructureSql — fold (consolidated granularity)', () => {
  it('additionally inlines safe FKs into the table definition', () => {
    const result = restructureSql(ATOMIC, { granularity: 'consolidated' });
    expect(result.sql).toMatchSnapshot();
    expect(result.sql).not.toContain('ALTER TABLE');
    // users must be emitted before orders (FK dependency).
    expect(result.sql.indexOf('CREATE TABLE app.users'))
      .toBeLessThan(result.sql.indexOf('CREATE TABLE app.orders'));
  });

  it('keeps mutually-referencing FKs atomic instead of breaking the cycle', () => {
    const cyclic = `
      CREATE TABLE app.a ();
      ALTER TABLE app.a ADD COLUMN id uuid;
      ALTER TABLE app.a ADD COLUMN b_id uuid;
      ALTER TABLE app.a ADD CONSTRAINT a_pkey PRIMARY KEY (id);
      CREATE TABLE app.b ();
      ALTER TABLE app.b ADD COLUMN id uuid;
      ALTER TABLE app.b ADD COLUMN a_id uuid;
      ALTER TABLE app.b ADD CONSTRAINT b_pkey PRIMARY KEY (id);
      ALTER TABLE app.a ADD CONSTRAINT a_b_fk FOREIGN KEY (b_id) REFERENCES app.b (id);
      ALTER TABLE app.b ADD CONSTRAINT b_a_fk FOREIGN KEY (a_id) REFERENCES app.a (id);
    `;
    const result = restructureSql(cyclic, { granularity: 'consolidated' });
    // At least one FK must remain an ALTER TABLE to break the cycle.
    expect(result.sql).toContain('ALTER TABLE');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.sql).toMatchSnapshot();
  });

  it('inlines a self-referencing FK', () => {
    const selfRef = `
      CREATE TABLE app.tree ();
      ALTER TABLE app.tree ADD COLUMN id uuid;
      ALTER TABLE app.tree ADD CONSTRAINT tree_pkey PRIMARY KEY (id);
      ALTER TABLE app.tree ADD COLUMN parent_id uuid;
      ALTER TABLE app.tree ADD CONSTRAINT tree_parent_fk FOREIGN KEY (parent_id) REFERENCES app.tree (id);
    `;
    const result = restructureSql(selfRef, { granularity: 'consolidated' });
    expect(result.sql).not.toContain('ALTER TABLE');
    expect(result.sql).toContain('FOREIGN KEY');
  });
});

describe('restructureSql — atomize', () => {
  const CONSOLIDATED = `
    CREATE TABLE app.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      CONSTRAINT users_email_uniq UNIQUE (email)
    );
    CREATE TABLE app.orders (
      id uuid PRIMARY KEY,
      user_id uuid REFERENCES app.users (id)
    );
  `;

  it('explodes CREATE TABLE into bare create + per-column/per-constraint alters', () => {
    const result = restructureSql(CONSOLIDATED, { granularity: 'atomic' });
    expect(result.sql).toMatchSnapshot();
    expect(result.exploded).toBeGreaterThan(0);
    expect(result.sql).toMatch(/CREATE TABLE app\.users \(\s*\)/);
    expect(result.sql).toContain('ADD COLUMN');
    // Column-level PK/UNIQUE/FK promoted to table-level ADD CONSTRAINT.
    expect(result.sql).toContain('PRIMARY KEY (id)');
    expect(result.sql).toMatch(/FOREIGN KEY\s*\(user_id\)/);
    // Defaults and NOT NULL stay inline on the column.
    expect(result.sql).toMatch(/ADD COLUMN email text\s+NOT NULL/);
    expect(result.sql).toMatch(/ADD COLUMN id uuid\s+DEFAULT gen_random_uuid\(\)/);
  });

  it('round-trips: atomize then consolidate returns the baked shape', () => {
    const atomic = restructureSql(CONSOLIDATED, { granularity: 'atomic' });
    const back = restructureSql(atomic.sql, { granularity: 'consolidated' });
    expect(back.sql).not.toContain('ALTER TABLE');
    expect(back.sql).toContain('CREATE TABLE app.users');
    expect(back.sql).toContain('CREATE TABLE app.orders');
    expect(back.sql).toContain('FOREIGN KEY');
  });

  it('leaves partitioned/typed tables intact', () => {
    const sql = 'CREATE TABLE app.log_2026 PARTITION OF app.log FOR VALUES FROM (1) TO (2);';
    const result = restructureSql(sql, { granularity: 'atomic' });
    expect(result.exploded).toBe(0);
  });
});
