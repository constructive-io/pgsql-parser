import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { configDir, findConfigFile, loadLintConfig } from '../src';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pgsql-lint-config-'));
}

function write(dir: string, name: string, body: unknown): string {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(body, null, 2));
  return file;
}

describe('loadLintConfig', () => {
  it('returns an empty config when no file exists', () => {
    const dir = tmpdir();
    expect(loadLintConfig({ cwd: dir })).toEqual({ config: {} });
  });

  it('discovers .pgsqllintrc.json by walking up from cwd', () => {
    const dir = tmpdir();
    write(dir, '.pgsqllintrc.json', { ignore: ['sql/'], paths: ['packages'] });
    const nested = path.join(dir, 'a', 'b');
    fs.mkdirSync(nested, { recursive: true });

    const loaded = loadLintConfig({ cwd: nested });
    expect(loaded.filepath).toBe(path.join(dir, '.pgsqllintrc.json'));
    expect(loaded.config.ignore).toEqual(['sql/']);
    expect(loaded.config.paths).toEqual(['packages']);
    expect(configDir(loaded, nested)).toBe(dir);
    expect(findConfigFile(nested)).toBe(path.join(dir, '.pgsqllintrc.json'));
  });

  it('reads an explicit config file', () => {
    const dir = tmpdir();
    write(dir, 'ci/lint.json', { off: ['C2'] });
    const loaded = loadLintConfig({ cwd: dir, configFile: 'ci/lint.json' });
    expect(loaded.config.off).toEqual(['C2']);
    expect(configDir(loaded, dir)).toBe(path.join(dir, 'ci'));
  });

  it('resolves extends against the declaring file and lets the child win', () => {
    const dir = tmpdir();
    write(dir, 'base.json', { ignore: ['sql/'], warn: ['C3'], keyword: ['pgsql-lint'] });
    write(dir, '.pgsqllintrc.json', { extends: './base.json', warn: ['C4'] });

    const { config } = loadLintConfig({ cwd: dir });
    expect(config.ignore).toEqual(['sql/']);
    expect(config.keyword).toEqual(['pgsql-lint']);
    expect(config.warn).toEqual(['C4']);
    expect(config.extends).toBeUndefined();
  });

  it('throws on an unresolvable extends target', () => {
    const dir = tmpdir();
    write(dir, '.pgsqllintrc.json', { extends: './nope.json' });
    expect(() => loadLintConfig({ cwd: dir })).toThrow(/could not resolve "extends"/);
  });

  it('throws on a circular extends chain', () => {
    const dir = tmpdir();
    write(dir, 'a.json', { extends: './b.json' });
    write(dir, 'b.json', { extends: './a.json' });
    write(dir, '.pgsqllintrc.json', { extends: './a.json' });
    expect(() => loadLintConfig({ cwd: dir })).toThrow(/circular/);
  });

  it('rejects unknown keys', () => {
    const dir = tmpdir();
    write(dir, '.pgsqllintrc.json', { rulez: ['C1'] });
    expect(() => loadLintConfig({ cwd: dir })).toThrow(/unknown key\(s\) rulez/);
  });

  it('reports a parse error with the file name', () => {
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, '.pgsqllintrc.json'), '{ not json');
    expect(() => loadLintConfig({ cwd: dir })).toThrow(/could not parse/);
  });
});
