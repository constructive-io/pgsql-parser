import { nestedObjCode } from '../src/inline-helpers';

describe('inlined nested-obj helper', () => {
  it('emits the bracket-notation regex unescaped by the template literal', () => {
    expect(nestedObjCode).toContain('path.replace(/\\[(\\w+)\\]/g, \'.$1\')');
  });

  it('guards every accessor against prototype pollution', () => {
    expect(nestedObjCode).toContain(
      'const UNSAFE_KEYS = new Set([\'__proto__\', \'constructor\', \'prototype\']);'
    );
    expect(nestedObjCode).toContain('throw new Error(\'Unsafe path segment: \' + key);');
    // get, set and has all route through the validating parser
    expect(nestedObjCode.match(/const keys = parsePath\(path\);/g)).toHaveLength(3);
  });
});
