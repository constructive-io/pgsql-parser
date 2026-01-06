import { loadModule, parseSync } from '@libpg-query/parser';
import { getReturnInfo, getReturnInfoFromParsedFunction } from '../src/return-info';

describe('getReturnInfo', () => {
  beforeAll(async () => {
    await loadModule();
  });

  const parseCreateFunction = (sql: string): any => {
    const result = parseSync(sql);
    const stmt = result.stmts?.[0]?.stmt as any;
    return stmt?.CreateFunctionStmt;
  };

  describe('void functions', () => {
    it('should return void for RETURNS void', () => {
      const stmt = parseCreateFunction(`
        CREATE FUNCTION test_void() RETURNS void
        LANGUAGE plpgsql AS $$ BEGIN END; $$
      `);
      expect(getReturnInfo(stmt)).toEqual({ kind: 'void' });
    });

    it('should return void for procedures', () => {
      const stmt = parseCreateFunction(`
        CREATE PROCEDURE test_proc()
        LANGUAGE plpgsql AS $$ BEGIN END; $$
      `);
      expect(getReturnInfo(stmt)).toEqual({ kind: 'void' });
    });
  });

  describe('setof functions', () => {
    it('should return setof for RETURNS SETOF integer', () => {
      const stmt = parseCreateFunction(`
        CREATE FUNCTION test_setof() RETURNS SETOF integer
        LANGUAGE plpgsql AS $$ BEGIN RETURN NEXT 1; END; $$
      `);
      expect(getReturnInfo(stmt)).toEqual({ kind: 'setof' });
    });

    it('should return setof for RETURNS SETOF record', () => {
      const stmt = parseCreateFunction(`
        CREATE FUNCTION test_setof_record() RETURNS SETOF record
        LANGUAGE plpgsql AS $$ BEGIN END; $$
      `);
      expect(getReturnInfo(stmt)).toEqual({ kind: 'setof' });
    });
  });

  describe('trigger functions', () => {
    it('should return trigger for RETURNS trigger', () => {
      const stmt = parseCreateFunction(`
        CREATE FUNCTION test_trigger() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$
      `);
      expect(getReturnInfo(stmt)).toEqual({ kind: 'trigger' });
    });
  });

  describe('out_params functions', () => {
    it('should return out_params for OUT parameters', () => {
      const stmt = parseCreateFunction(`
        CREATE FUNCTION test_out(IN x integer, OUT result integer)
        LANGUAGE plpgsql AS $$ BEGIN result := x * 2; END; $$
      `);
      expect(getReturnInfo(stmt)).toEqual({ kind: 'out_params' });
    });

    it('should return out_params for INOUT parameters', () => {
      const stmt = parseCreateFunction(`
        CREATE FUNCTION test_inout(INOUT x integer)
        LANGUAGE plpgsql AS $$ BEGIN x := x * 2; END; $$
      `);
      expect(getReturnInfo(stmt)).toEqual({ kind: 'out_params' });
    });

    it('should return out_params for RETURNS TABLE', () => {
      const stmt = parseCreateFunction(`
        CREATE FUNCTION test_table() RETURNS TABLE (id integer, name text)
        LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY SELECT 1, 'test'; END; $$
      `);
      expect(getReturnInfo(stmt)).toEqual({ kind: 'out_params' });
    });
  });

  describe('scalar functions', () => {
    it('should return scalar for RETURNS integer', () => {
      const stmt = parseCreateFunction(`
        CREATE FUNCTION test_scalar() RETURNS integer
        LANGUAGE plpgsql AS $$ BEGIN RETURN 42; END; $$
      `);
      expect(getReturnInfo(stmt)).toEqual({ kind: 'scalar' });
    });

    it('should return scalar for RETURNS text', () => {
      const stmt = parseCreateFunction(`
        CREATE FUNCTION test_text() RETURNS text
        LANGUAGE plpgsql AS $$ BEGIN RETURN 'hello'; END; $$
      `);
      expect(getReturnInfo(stmt)).toEqual({ kind: 'scalar' });
    });

    it('should return scalar for RETURNS record (non-setof)', () => {
      const stmt = parseCreateFunction(`
        CREATE FUNCTION test_record() RETURNS record
        LANGUAGE plpgsql AS $$ BEGIN RETURN ROW(1, 'test'); END; $$
      `);
      expect(getReturnInfo(stmt)).toEqual({ kind: 'scalar' });
    });
  });

  describe('edge cases', () => {
    it('should return scalar for null input', () => {
      expect(getReturnInfo(null)).toEqual({ kind: 'scalar' });
    });

    it('should return scalar for undefined input', () => {
      expect(getReturnInfo(undefined)).toEqual({ kind: 'scalar' });
    });

    it('should return void for missing return type', () => {
      const stmt = { funcname: [{ String: { sval: 'test' } }] };
      expect(getReturnInfo(stmt)).toEqual({ kind: 'void' });
    });
  });
});

describe('getReturnInfoFromParsedFunction', () => {
  beforeAll(async () => {
    await loadModule();
  });

  it('should extract return info from ParsedFunction-like object', () => {
    const result = parseSync(`
      CREATE FUNCTION test() RETURNS integer
      LANGUAGE plpgsql AS $$ BEGIN RETURN 1; END; $$
    `);
    const stmtWrapper = result.stmts?.[0]?.stmt as any;
    const stmt = stmtWrapper?.CreateFunctionStmt;
    
    const parsedFunction = { stmt };
    expect(getReturnInfoFromParsedFunction(parsedFunction)).toEqual({ kind: 'scalar' });
  });

  it('should return scalar for null input', () => {
    expect(getReturnInfoFromParsedFunction(null)).toEqual({ kind: 'scalar' });
  });
});
