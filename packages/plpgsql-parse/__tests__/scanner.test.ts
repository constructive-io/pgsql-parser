import { scanBodyComments, groupCommentsByAnchor } from '../src/body-scanner';

describe('scanBodyComments', () => {
  it('should extract standalone comment lines', () => {
    const body = `
DECLARE
  v_count integer;
BEGIN
  -- Count all active users
  SELECT count(*) INTO v_count FROM users;
  RETURN v_count;
END;`;
    const comments = scanBodyComments(body);
    expect(comments).toHaveLength(1);
    expect(comments[0].text).toBe('-- Count all active users');
    expect(comments[0].standalone).toBe(true);
  });

  it('should extract multiple comment lines', () => {
    const body = `
BEGIN
  -- First comment
  PERFORM do_something();
  -- Second comment
  -- Third comment
  RETURN 1;
END;`;
    const comments = scanBodyComments(body);
    expect(comments).toHaveLength(3);
    expect(comments[0].text).toBe('-- First comment');
    expect(comments[1].text).toBe('-- Second comment');
    expect(comments[2].text).toBe('-- Third comment');
  });

  it('should return empty array for bodies without comments', () => {
    const body = `
BEGIN
  RETURN 1;
END;`;
    const comments = scanBodyComments(body);
    expect(comments).toHaveLength(0);
  });

  it('should preserve line numbers (1-based)', () => {
    const body = `BEGIN
  -- line 2 comment
  RETURN 1;
END;`;
    const comments = scanBodyComments(body);
    expect(comments).toHaveLength(1);
    expect(comments[0].lineNo).toBe(2);
  });

  it('should handle comments at various indent levels', () => {
    const body = `
BEGIN
  IF true THEN
    -- indented comment
    RETURN 1;
  END IF;
END;`;
    const comments = scanBodyComments(body);
    expect(comments).toHaveLength(1);
    expect(comments[0].text).toBe('-- indented comment');
  });
});

describe('groupCommentsByAnchor', () => {
  it('should group consecutive comments together', () => {
    const comments = [
      { text: '-- first', lineNo: 3, standalone: true },
      { text: '-- second', lineNo: 4, standalone: true },
    ];
    const stmtLinenos = [5, 8];
    const groups = groupCommentsByAnchor(comments, stmtLinenos);
    expect(groups).toHaveLength(1);
    expect(groups[0].comments).toEqual(['-- first', '-- second']);
    expect(groups[0].anchorLineno).toBe(5);
  });

  it('should separate non-consecutive comments into different groups', () => {
    const comments = [
      { text: '-- before first stmt', lineNo: 3, standalone: true },
      { text: '-- before second stmt', lineNo: 6, standalone: true },
    ];
    const stmtLinenos = [4, 7];
    const groups = groupCommentsByAnchor(comments, stmtLinenos);
    expect(groups).toHaveLength(2);
    expect(groups[0].anchorLineno).toBe(4);
    expect(groups[1].anchorLineno).toBe(7);
  });

  it('should set anchorLineno to null for trailing comments', () => {
    const comments = [
      { text: '-- trailing comment', lineNo: 10, standalone: true },
    ];
    const stmtLinenos = [3, 5]; // all before the comment
    const groups = groupCommentsByAnchor(comments, stmtLinenos);
    expect(groups).toHaveLength(1);
    expect(groups[0].anchorLineno).toBeNull();
  });

  it('should return empty array for no comments', () => {
    const groups = groupCommentsByAnchor([], [3, 5]);
    expect(groups).toHaveLength(0);
  });
});
