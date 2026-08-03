import * as path from 'path';

import { applyIgnore, makeIgnoreFilter } from '../src';

const CWD = '/repo';
const p = (rel: string): string => path.join(CWD, rel);

describe('makeIgnoreFilter', () => {
  it('excludes a whole subtree from a plain directory pattern', () => {
    const ignored = makeIgnoreFilter(['sql/'], CWD);
    expect(ignored(p('sql/app--1.0.0.sql'))).toBe(true);
    expect(ignored(p('sql/nested/deep.sql'))).toBe(true);
    expect(ignored(p('packages/x/deploy/a.sql'))).toBe(false);
  });

  it('treats a slashless plain path the same as a directory', () => {
    const ignored = makeIgnoreFilter(['application/constructive'], CWD);
    expect(ignored(p('application/constructive/deploy/a.sql'))).toBe(true);
    expect(ignored(p('application/app/deploy/a.sql'))).toBe(false);
  });

  it('matches an unanchored pattern at any segment boundary', () => {
    const ignored = makeIgnoreFilter(['generated/'], CWD);
    expect(ignored(p('packages/x/generated/y.sql'))).toBe(true);
    expect(ignored(p('generated/y.sql'))).toBe(true);
  });

  it('anchors a leading-slash pattern to cwd', () => {
    const ignored = makeIgnoreFilter(['/sql/'], CWD);
    expect(ignored(p('sql/a.sql'))).toBe(true);
    expect(ignored(p('packages/x/sql/a.sql'))).toBe(false);
  });

  it('supports * within a segment and ** across segments', () => {
    const ignored = makeIgnoreFilter(['**/testing/*-seed/**', '*.gen.sql'], CWD);
    expect(ignored(p('testing/rls-seed/deploy/a.sql'))).toBe(true);
    expect(ignored(p('a/b/testing/simple-seed/x.sql'))).toBe(true);
    expect(ignored(p('testing/other/x.sql'))).toBe(false);
    expect(ignored(p('packages/x/schema.gen.sql'))).toBe(true);
    expect(ignored(p('packages/x/schema.sql'))).toBe(false);
  });

  it('matches zero segments for a leading **/', () => {
    const ignored = makeIgnoreFilter(['**/sql/**'], CWD);
    expect(ignored(p('sql/a.sql'))).toBe(true);
    expect(ignored(p('packages/x/sql/a.sql'))).toBe(true);
  });

  it('ignores nothing when no patterns are given', () => {
    expect(makeIgnoreFilter([], CWD)(p('a.sql'))).toBe(false);
    expect(applyIgnore([p('a.sql')], undefined, CWD)).toEqual([p('a.sql')]);
  });

  it('filters a file list', () => {
    const files = [p('sql/a.sql'), p('packages/x/deploy/b.sql')];
    expect(applyIgnore(files, ['sql/'], CWD)).toEqual([p('packages/x/deploy/b.sql')]);
  });
});
