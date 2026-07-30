import {
  COMMON_EXTENSIONS,
  ExtensionDefinition,
  ExtensionRouter
} from '../src/extension-router';

describe('ExtensionRouter.resolveInstall', () => {
  it('returns the target schema for a routed extension', () => {
    const router = new ExtensionRouter({ pgcrypto: { to: 'extensions' } });
    expect(router.resolveInstall('pgcrypto')).toBe('extensions');
  });

  it('returns null to strip the SCHEMA clause (repollute)', () => {
    const router = new ExtensionRouter({ pgcrypto: { to: null } });
    expect(router.resolveInstall('pgcrypto')).toBeNull();
  });

  it('returns undefined (leave unchanged) for an unrouted extension', () => {
    const router = new ExtensionRouter({ pgcrypto: { to: 'extensions' } });
    expect(router.resolveInstall('pg_trgm')).toBeUndefined();
    expect(router.resolveInstall(undefined)).toBeUndefined();
  });

  it('refuses to move an extension pinned to a fixed schema', () => {
    const inventory: ExtensionDefinition[] = [
      { name: 'postgis_tiger_geocoder', fixedSchema: 'tiger', symbols: [] }
    ];
    const router = new ExtensionRouter(
      { postgis_tiger_geocoder: { to: 'extensions' } },
      { inventory }
    );
    expect(router.resolveInstall('postgis_tiger_geocoder')).toBeUndefined();
  });
});

describe('ExtensionRouter.resolveSymbol', () => {
  it('routes a bare extension symbol to the target schema', () => {
    const router = ExtensionRouter.toSchema('extensions');
    expect(router.resolveSymbol(null, 'crypt', 'function')).toEqual({ to: 'extensions' });
    expect(router.resolveSymbol(null, 'gen_salt', 'function')).toEqual({ to: 'extensions' });
  });

  it('requalifies a public-qualified symbol', () => {
    const router = ExtensionRouter.toSchema('extensions');
    expect(router.resolveSymbol('public', 'digest', 'function')).toEqual({ to: 'extensions' });
  });

  it('strips qualification when routing to bare (null)', () => {
    const router = ExtensionRouter.toSchema(null, { from: ['extensions'] });
    expect(router.resolveSymbol('extensions', 'crypt', 'function')).toEqual({ to: null });
  });

  it('leaves symbols already in the target schema unchanged', () => {
    const router = ExtensionRouter.toSchema('extensions');
    expect(router.resolveSymbol('extensions', 'crypt', 'function')).toBeUndefined();
  });

  it('never routes a symbol that graduated into core at the target version', () => {
    const pg13 = ExtensionRouter.toSchema('extensions', { serverVersion: 13 });
    expect(pg13.resolveSymbol(null, 'gen_random_uuid', 'function')).toBeUndefined();

    const pg12 = ExtensionRouter.toSchema('extensions', { serverVersion: 12 });
    expect(pg12.resolveSymbol(null, 'gen_random_uuid', 'function')).toEqual({ to: 'extensions' });
  });

  it('routes extension-provided types (citext)', () => {
    const router = ExtensionRouter.toSchema('extensions');
    expect(router.resolveSymbol(null, 'citext', 'type')).toEqual({ to: 'extensions' });
    // citext is a type, not a function — namespace must match
    expect(router.resolveSymbol(null, 'citext', 'function')).toBeUndefined();
  });

  it('ignores symbols not in the inventory (user-defined lookalikes)', () => {
    const router = ExtensionRouter.toSchema('extensions');
    expect(router.resolveSymbol(null, 'my_helper', 'function')).toBeUndefined();
    expect(router.resolveSymbol('app', 'crypt', 'function')).toBeUndefined();
  });

  it('honors an explicit `from` allowlist', () => {
    const router = new ExtensionRouter({ pgcrypto: { to: 'extensions', from: ['public'] } });
    // only public-qualified refs are rewritten; bare refs are left alone
    expect(router.resolveSymbol('public', 'crypt', 'function')).toEqual({ to: 'extensions' });
    expect(router.resolveSymbol(null, 'crypt', 'function')).toBeUndefined();
  });
});

describe('ExtensionRouter inventory', () => {
  it('exposes a curated set of common extensions', () => {
    const names = COMMON_EXTENSIONS.map(d => d.name);
    expect(names).toEqual(expect.arrayContaining(['pgcrypto', 'uuid-ossp', 'citext']));
  });

  it('reports whether configured extensions have symbol routes', () => {
    expect(ExtensionRouter.toSchema('extensions', { extensions: ['pgcrypto'] }).hasSymbolRoutes()).toBe(true);
    expect(new ExtensionRouter({ nonexistent_ext: { to: 'x' } }).hasSymbolRoutes()).toBe(false);
  });
});
