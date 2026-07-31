import { SUPPORTED_NODE_TAGS, SUPPORTED_STATEMENTS } from '../src/supported';

describe('SUPPORTED_STATEMENTS', () => {
  it('every entry has at least one node tag and a revert or verify derivation', () => {
    for (const entry of SUPPORTED_STATEMENTS) {
      expect(entry.nodeTags.length).toBeGreaterThan(0);
      expect(entry.revert !== null || entry.verify !== null).toBe(true);
    }
  });

  it('SUPPORTED_NODE_TAGS covers every listed node tag', () => {
    for (const entry of SUPPORTED_STATEMENTS) {
      for (const tag of entry.nodeTags) {
        expect(SUPPORTED_NODE_TAGS.has(tag)).toBe(true);
      }
    }
  });

  it('does not claim support for statements that only warn', () => {
    for (const tag of ['InsertStmt', 'UpdateStmt', 'DeleteStmt', 'DoStmt', 'VariableSetStmt']) {
      expect(SUPPORTED_NODE_TAGS.has(tag)).toBe(false);
    }
  });
});
