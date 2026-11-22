import { walkPlpgsqlAst } from '../src';

describe('walkPlpgsqlAst PLpgSQL_rec', () => {
  it('visits the datatype and default value of a record declaration', () => {
    const rec = {
      PLpgSQL_rec: {
        refname: 'x',
        dno: 0,
        datatype: { PLpgSQL_type: { typname: 'record' } },
        default_val: { PLpgSQL_expr: { query: 'row(1,2,3)', parseMode: 2 } },
      },
    };
    const visited: string[] = [];

    walkPlpgsqlAst(
      rec,
      {
        PLpgSQL_type: (path) => {
          visited.push(`type:${path.node.typname}`);
        },
        PLpgSQL_expr: (path) => {
          visited.push(`expr:${path.node.query}`);
        },
      },
      { walkSqlExpressions: false }
    );

    expect(visited).toEqual(['type:record', 'expr:row(1,2,3)']);
  });
});
