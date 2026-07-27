import { loadModule } from 'plpgsql-parser';

import { makeNamespaceValidator, makeSchemaTranspiler } from '../src';

beforeAll(async () => {
  await loadModule();
});

const CTX = { change: 'schemas/auth/tables/users', kind: 'deploy' as const };

describe('makeSchemaTranspiler', () => {
  const transpiler = () =>
    makeSchemaTranspiler({ schemaMap: { auth: 'tenant_auth', billing: 'tenant_billing' } });

  describe('renameChange', () => {
    it('renames the segment following a schemas segment', () => {
      const { renameChange } = transpiler();
      expect(renameChange('schemas/auth/tables/users')).toBe('schemas/tenant_auth/tables/users');
      expect(renameChange('schemas/billing/procedures/charge')).toBe(
        'schemas/tenant_billing/procedures/charge'
      );
    });

    it('leaves unmapped schemas and non-schema segments untouched', () => {
      const { renameChange } = transpiler();
      expect(renameChange('schemas/public/tables/logs')).toBe('schemas/public/tables/logs');
      expect(renameChange('roles/auth')).toBe('roles/auth');
      expect(renameChange('extensions/auth/setup')).toBe('extensions/auth/setup');
    });

    it('does not rename a table segment that matches a schema name', () => {
      const { renameChange } = transpiler();
      expect(renameChange('schemas/public/tables/auth')).toBe('schemas/public/tables/auth');
    });
  });

  describe('transformScript', () => {
    it('rewrites schema references via the AST, not text', () => {
      const t = transpiler();
      const sql = [
        '-- Deploy myapp:schemas/auth/tables/users to pg',
        '',
        'CREATE TABLE auth.users (',
        '  id uuid PRIMARY KEY,',
        '  auth text,',
        "  note text DEFAULT 'auth'",
        ');'
      ].join('\n');
      const out = t.transformScript(sql, CTX);
      expect(out).toContain('tenant_auth.users');
      // column named auth and string literal 'auth' are untouched
      expect(out).toMatch(/\bauth text\b/);
      expect(out).toContain("'auth'");
      expect(t.result.schemasTransformed.get('auth')).toBe('tenant_auth');
    });

    it('rewrites FK targets, grants, policies and function bodies', () => {
      const t = transpiler();
      const sql = [
        'CREATE TABLE billing.invoices (',
        '  id uuid PRIMARY KEY,',
        '  user_id uuid REFERENCES auth.users (id)',
        ');',
        'GRANT SELECT ON ALL TABLES IN SCHEMA billing TO authenticated;',
        'CREATE POLICY p ON billing.invoices USING (user_id = auth.current_user_id());',
        'CREATE FUNCTION billing.total()',
        'RETURNS bigint',
        'LANGUAGE plpgsql',
        'AS $$',
        'BEGIN',
        '  RETURN (SELECT count(*) FROM billing.invoices JOIN auth.users u ON u.id = user_id);',
        'END;',
        '$$;'
      ].join('\n');
      const out = t.transformScript(sql, CTX);
      expect(out).toContain('tenant_billing.invoices');
      expect(out).toContain('tenant_auth.users');
      expect(out).toContain('IN SCHEMA tenant_billing');
      expect(out).toContain('tenant_auth.current_user_id()');
      expect(out).not.toMatch(/\bbilling\./);
      expect(out).not.toMatch(/\bauth\./);
    });

    it('accumulates a report across scripts', () => {
      const t = transpiler();
      t.transformScript('CREATE TABLE auth.a (id int);', CTX);
      t.transformScript('CREATE TABLE billing.b (id int);', {
        change: 'schemas/billing/tables/b',
        kind: 'deploy'
      });
      expect([...t.result.schemasFound].sort()).toEqual(['auth', 'billing']);
      expect(t.result.errors).toEqual([]);
    });
  });
});

describe('makeNamespaceValidator', () => {
  it('reports creates/references/FK targets outside the allowed namespace', () => {
    const validate = makeNamespaceValidator({ allowedSchemas: ['tenant_auth', 'public'] });
    const violations = validate(
      [
        'CREATE TABLE tenant_auth.users (id uuid PRIMARY KEY);',
        'CREATE TABLE tenant_auth.sessions (',
        '  id uuid PRIMARY KEY,',
        '  user_id uuid REFERENCES other_app.users (id)',
        ');',
        'SELECT * FROM billing.invoices;'
      ].join('\n'),
      CTX
    );
    expect(violations.some(v => v.includes('other_app.users'))).toBe(true);
    expect(violations.some(v => v.includes('billing.invoices'))).toBe(true);
    expect(violations.some(v => v.includes('tenant_auth'))).toBe(false);
  });

  it('returns no violations when everything is contained', () => {
    const validate = makeNamespaceValidator({ allowedSchemas: ['tenant_auth'] });
    expect(
      validate('CREATE TABLE tenant_auth.users (id uuid PRIMARY KEY);', CTX)
    ).toEqual([]);
  });

  it('optionally flags dynamic SQL', () => {
    const sql = [
      'CREATE FUNCTION tenant_auth.run(q text)',
      'RETURNS void',
      'LANGUAGE plpgsql',
      'AS $$',
      'BEGIN',
      '  EXECUTE q;',
      'END;',
      '$$;'
    ].join('\n');
    const lax = makeNamespaceValidator({ allowedSchemas: ['tenant_auth'] });
    expect(lax(sql, CTX)).toEqual([]);
    const strict = makeNamespaceValidator({
      allowedSchemas: ['tenant_auth'],
      flagDynamicSql: true
    });
    expect(strict(sql, CTX).some(v => v.includes('dynamic SQL'))).toBe(true);
  });
});
