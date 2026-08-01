// Mirrors the published `nested-obj` package (>= 0.2.2), including its
// prototype-pollution guard. Backslashes are doubled so the emitted file
// contains the intended regex.
export const nestedObjCode = `
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function parsePath(path: string): string[] {
  const keys = path.replace(/\\[(\\w+)\\]/g, '.$1').split('.');
  for (const key of keys) {
    if (UNSAFE_KEYS.has(key)) {
      throw new Error('Unsafe path segment: ' + key);
    }
  }
  return keys;
}

export default {
  get<T>(obj: Record<string, any>, path: string): T | undefined {
    const keys = parsePath(path);
    let result: any = obj;
    for (const key of keys) {
      if (result == null) {
        return undefined;
      }
      result = result[key];
    }
    return result as T;
  },

  set(obj: Record<string, any>, path: string, value: any): void {
    if (value === undefined) {
      return;
    }

    const keys = parsePath(path);
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
  },

  has(obj: Record<string, any>, path: string): boolean {
    const keys = parsePath(path);
    let current = obj;
    for (const key of keys) {
      if (current == null || !(key in current)) {
        return false;
      }
      current = current[key];
    }
    return true;
  }
};
`;
