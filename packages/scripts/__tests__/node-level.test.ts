import { classifyStatements } from '@pgsql/transform';
import { Deparser, loadModule } from 'plpgsql-parser';

import { existenceCheck, invertStatement } from '../src/invert';

beforeAll(async () => {
  await loadModule();
});

const factsOf = (sql: string) => classifyStatements(sql)[0];

describe('invertStatement (node level)', () => {
  it('returns the inverse as AST statement nodes', () => {
    const nodes = invertStatement(factsOf('CREATE TABLE app.users (id int);'));
    expect(nodes).not.toBeNull();
    expect(nodes!).toHaveLength(1);
    expect(Object.keys(nodes![0])).toEqual(['DropStmt']);
    expect(Deparser.deparse(nodes![0])).toEqual('DROP TABLE app.users');
  });

  it('returns swapped-name AST nodes for renames', () => {
    const nodes = invertStatement(factsOf('ALTER TABLE app.users RENAME TO members;'));
    expect(nodes!).toHaveLength(1);
    expect(Deparser.deparse(nodes![0])).toEqual('ALTER TABLE app.members RENAME TO users');
  });

  it('returns null when no inverse is derivable', () => {
    expect(invertStatement(factsOf('UPDATE app.users SET name = 1;'))).toBeNull();
    expect(invertStatement(factsOf('ALTER TABLE users SET SCHEMA public;'))).toBeNull();
  });

  it('never returns a partial inverse for multi-command ALTER TABLE', () => {
    const facts = factsOf('ALTER TABLE app.users ADD COLUMN age int, ALTER COLUMN name SET NOT NULL;');
    expect(invertStatement(facts)).toBeNull();
  });
});

describe('existenceCheck (node level)', () => {
  it('returns the verify predicate as SelectStmt AST nodes', () => {
    const nodes = existenceCheck(factsOf('CREATE TABLE app.users (id int);'));
    expect(nodes).not.toBeNull();
    expect(nodes!).toHaveLength(1);
    expect(Object.keys(nodes![0])).toEqual(['SelectStmt']);
    expect(Deparser.deparse(nodes![0]).replace(/\s+/g, ' ')).toEqual(
      "SELECT 1 / (CASE WHEN to_regclass('app.users') IS NOT NULL THEN 1 ELSE 0 END);".replace(/;$/, '')
    );
  });

  it('returns one node per expanded GRANT ALL privilege', () => {
    const nodes = existenceCheck(factsOf('GRANT ALL ON SEQUENCE app.seq TO bob;'));
    expect(nodes!).toHaveLength(3);
    for (const node of nodes!) {
      expect(Object.keys(node)).toEqual(['SelectStmt']);
    }
  });

  it('returns an empty array when nothing comes into existence', () => {
    expect(existenceCheck(factsOf("COMMENT ON TABLE app.users IS 'x';"))).toEqual([]);
  });

  it('returns null when no check is derivable', () => {
    expect(existenceCheck(factsOf('DO $$ BEGIN NULL; END $$;'))).toBeNull();
  });
});
