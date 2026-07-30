import { MutablePath, traverse } from '../src';

const select = (relname: string) => ({
  SelectStmt: {
    targetList: [
      { ResTarget: { val: { ColumnRef: { fields: [{ A_Star: {} }] } } } }
    ],
    fromClause: [
      { RangeVar: { schemaname: 'app', relname, inh: true, relpersistence: 'p' } }
    ],
    limitOption: 'LIMIT_OPTION_DEFAULT',
    op: 'SETOP_NONE'
  }
});

const funcCallAst = () => ({
  FuncCall: {
    funcname: [
      { String: { sval: 'auth' } },
      { String: { sval: 'uid' } }
    ],
    funcformat: 'COERCE_EXPLICIT_CALL'
  }
});

describe('traverse: read semantics', () => {
  it('visits nodes with parent paths and key paths like walk', () => {
    const seen: Array<[string, (string | number)[]]> = [];
    traverse(select('posts'), {
      enter(path: MutablePath) {
        seen.push([path.tag, path.path]);
      }
    });
    const tags = seen.map(([t]) => t);
    expect(tags).toContain('SelectStmt');
    expect(tags).toContain('RangeVar');
    expect(tags).toContain('ResTarget');
    const rangeVar = seen.find(([t]) => t === 'RangeVar')!;
    expect(rangeVar[1]).toEqual(['fromClause', 0]);
  });

  it('return false skips children', () => {
    const tags: string[] = [];
    traverse(select('posts'), {
      enter(path: MutablePath) {
        tags.push(path.tag);
        if (path.tag === 'ResTarget') return false;
      }
    });
    expect(tags).toContain('ResTarget');
    expect(tags).not.toContain('ColumnRef');
  });

  it('skip() skips children; stop() ends the traversal', () => {
    const tags: string[] = [];
    traverse(select('posts'), {
      enter(path: MutablePath) {
        tags.push(path.tag);
        if (path.tag === 'ResTarget') path.skip();
      }
    });
    expect(tags).not.toContain('ColumnRef');

    const seen: string[] = [];
    traverse(select('posts'), {
      enter(path: MutablePath) {
        seen.push(path.tag);
        if (path.tag === 'RangeVar') path.stop();
      }
    });
    expect(seen).toContain('RangeVar');
    expect(seen).not.toContain('ResTarget');
  });

  it('runs exit handlers post-order', () => {
    const order: string[] = [];
    traverse(select('posts'), {
      SelectStmt: {
        enter() {
          order.push('enter:SelectStmt');
        },
        exit() {
          order.push('exit:SelectStmt');
        }
      },
      RangeVar(path: MutablePath) {
        order.push(`enter:${path.tag}`);
      }
    });
    expect(order[0]).toBe('enter:SelectStmt');
    expect(order[order.length - 1]).toBe('exit:SelectStmt');
    expect(order).toContain('enter:RangeVar');
  });
});

describe('traverse: mutation', () => {
  it('replaceWith swaps a tagged node in an array container', () => {
    const ast = select('posts');
    traverse(ast, {
      RangeVar(path: MutablePath) {
        path.replaceWith({
          RangeVar: { relname: 'users', inh: true, relpersistence: 'p' }
        });
      }
    });
    expect(ast.SelectStmt.fromClause[0]).toEqual({
      RangeVar: { relname: 'users', inh: true, relpersistence: 'p' }
    });
  });

  it('replaceWith traverses the replacement children but does not re-invoke on the replacement', () => {
    const ast = select('posts');
    let rangeVarVisits = 0;
    const innerTags: string[] = [];
    traverse(ast, {
      ResTarget(path: MutablePath) {
        path.replaceWith({
          ResTarget: { val: { FuncCall: funcCallAst().FuncCall } }
        });
      },
      FuncCall(path: MutablePath) {
        innerTags.push(path.tag);
      },
      RangeVar() {
        rangeVarVisits++;
      }
    });
    expect(innerTags).toEqual(['FuncCall']);
    expect(rangeVarVisits).toBe(1);
  });

  it('remove splices from an array container and keeps sibling iteration aligned', () => {
    const ast = {
      List: {
        items: [
          { String: { sval: 'a' } },
          { String: { sval: 'b' } },
          { String: { sval: 'c' } }
        ]
      }
    };
    const visited: string[] = [];
    traverse(ast, {
      String(path: MutablePath) {
        visited.push(path.node.sval);
        if (path.node.sval === 'b') path.remove();
      }
    });
    expect(visited).toEqual(['a', 'b', 'c']);
    expect(ast.List.items.map((i: any) => i.String.sval)).toEqual(['a', 'c']);
  });

  it('remove deletes an object field container entry', () => {
    const ast = select('posts');
    traverse(ast, {
      RangeVar(path: MutablePath) {
        path.remove();
      }
    });
    expect(ast.SelectStmt.fromClause).toEqual([]);
  });

  it('insertBefore and insertAfter add unvisited siblings', () => {
    const ast = {
      List: {
        items: [{ String: { sval: 'mid' } }]
      }
    };
    const visited: string[] = [];
    traverse(ast, {
      String(path: MutablePath) {
        visited.push(path.node.sval);
        if (path.node.sval === 'mid') {
          path.insertBefore({ String: { sval: 'pre' } });
          path.insertAfter({ String: { sval: 'post' } });
        }
      }
    });
    expect(visited).toEqual(['mid']);
    expect(ast.List.items.map((i: any) => i.String.sval)).toEqual(['pre', 'mid', 'post']);
  });

  it('mutates concrete typed fields stored as bare objects (CreatePolicyStmt.table)', () => {
    const ast = {
      CreatePolicyStmt: {
        policy_name: 'p',
        table: { schemaname: 'app', relname: 'posts', inh: true, relpersistence: 'p' },
        cmd_name: 'select',
        permissive: true
      }
    };
    traverse(ast, {
      RangeVar(path: MutablePath) {
        path.replaceWith({ schemaname: 'tenant', relname: 'posts', inh: true, relpersistence: 'p' });
      }
    });
    expect(ast.CreatePolicyStmt.table.schemaname).toBe('tenant');
  });

  it('throws when mutating a detached root', () => {
    expect(() =>
      traverse(select('posts'), {
        SelectStmt(path: MutablePath) {
          path.remove();
        }
      })
    ).toThrow(/detached/);
  });
});
