import { loadModule } from 'plpgsql-parser';

import { classifyStatements } from '../src/facts';
import { buildStatementGraph } from '../src/graph';

beforeAll(async () => {
  await loadModule();
});

const graphOf = (sql: string) => buildStatementGraph(classifyStatements(sql));

describe('buildStatementGraph', () => {
  it('links references to their producers with hard edges', () => {
    const g = graphOf(`
      CREATE TABLE app.users (id int);
      CREATE VIEW app.v_users AS SELECT * FROM app.users;
    `);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]).toMatchObject({ from: 1, to: 0, kind: 'hard' });
    expect(g.order).toEqual([0, 1]);
  });

  it('classifies FK targets as fk edges', () => {
    const g = graphOf(`
      CREATE TABLE app.orders (id int);
      CREATE TABLE app.users (id int);
      ALTER TABLE app.orders ADD CONSTRAINT fk FOREIGN KEY (id) REFERENCES app.users (id);
    `);
    const fk = g.edges.find(e => e.kind === 'fk');
    expect(fk).toMatchObject({ from: 2, to: 1 });
    // ALTER also hard-depends on its own table via creates/references dedupe:
    // the alter "creates" (targets) app.orders so no self edge exists.
    expect(g.order.indexOf(1)).toBeLessThan(g.order.indexOf(2));
  });

  it('treats PL/pgSQL body references as late edges that allow cycles', () => {
    const g = graphOf(`
      CREATE FUNCTION app.a() RETURNS int LANGUAGE plpgsql AS $$ BEGIN RETURN app.b(); END $$;
      CREATE FUNCTION app.b() RETURNS int LANGUAGE plpgsql AS $$ BEGIN RETURN app.a(); END $$;
    `);
    expect(g.edges.every(e => e.kind === 'late')).toBe(true);
    // Late edges never force multi-member components.
    expect(g.components.every(c => c.length === 1)).toBe(true);
    expect(g.order).toEqual([0, 1]);
  });

  it('orders mutually-referencing FKs without a cycle at statement granularity', () => {
    const g = graphOf(`
      CREATE TABLE app.a (id int);
      CREATE TABLE app.b (id int);
      ALTER TABLE app.a ADD CONSTRAINT fk_ab FOREIGN KEY (id) REFERENCES app.b (id);
      ALTER TABLE app.b ADD CONSTRAINT fk_ba FOREIGN KEY (id) REFERENCES app.a (id);
    `);
    // Atomic statements are exactly what makes mutual FKs deployable: the
    // separate ALTERs order after both CREATEs, so no component is bigger
    // than one statement. (The cycle only appears when folding — which is
    // why restructure keeps such FKs atomic.)
    expect(g.components.every(c => c.length === 1)).toBe(true);
    expect(g.order.indexOf(2)).toBeGreaterThan(g.order.indexOf(1));
    expect(g.order.indexOf(3)).toBeGreaterThan(g.order.indexOf(0));
  });

  it('produces a stable topological order (source order for ties)', () => {
    const g = graphOf(`
      CREATE TABLE app.z (id int);
      CREATE TABLE app.a (id int);
      CREATE TABLE app.m (id int);
    `);
    expect(g.order).toEqual([0, 1, 2]);
  });

  it('reorders forward references', () => {
    const g = graphOf(`
      CREATE VIEW app.v AS SELECT * FROM app.t;
      CREATE TABLE app.t (id int);
    `);
    expect(g.order).toEqual([1, 0]);
  });
});
