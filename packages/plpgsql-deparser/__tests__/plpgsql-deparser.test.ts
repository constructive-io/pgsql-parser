import { PLpgSQLDeparser, deparseSync, PLpgSQLParseResult } from '../src';

describe('PLpgSQLDeparser', () => {
  describe('deparseSync', () => {
    it('should deparse a simple function body', () => {
      const parseResult: PLpgSQLParseResult = {
        plpgsql_funcs: [
          {
            PLpgSQL_function: {
              datums: [
                {
                  PLpgSQL_var: {
                    refname: 'found',
                    datatype: {
                      PLpgSQL_type: {
                        typname: 'pg_catalog."boolean"',
                      },
                    },
                  },
                },
              ],
              action: {
                PLpgSQL_stmt_block: {
                  lineno: 1,
                  body: [
                    {
                      PLpgSQL_stmt_return: {
                        lineno: 2,
                        expr: {
                          PLpgSQL_expr: {
                            query: '42',
                            parseMode: 2,
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      const result = deparseSync(parseResult);
      expect(result).toContain('BEGIN');
      expect(result).toContain('RETURN 42');
      expect(result).toContain('END');
    });

    it('should deparse IF statement', () => {
      const parseResult: PLpgSQLParseResult = {
        plpgsql_funcs: [
          {
            PLpgSQL_function: {
              action: {
                PLpgSQL_stmt_block: {
                  lineno: 1,
                  body: [
                    {
                      PLpgSQL_stmt_if: {
                        lineno: 2,
                        cond: {
                          PLpgSQL_expr: {
                            query: 'x > 0',
                            parseMode: 2,
                          },
                        },
                        then_body: [
                          {
                            PLpgSQL_stmt_return: {
                              lineno: 3,
                              expr: {
                                PLpgSQL_expr: {
                                  query: '1',
                                  parseMode: 2,
                                },
                              },
                            },
                          },
                        ],
                        else_body: [
                          {
                            PLpgSQL_stmt_return: {
                              lineno: 5,
                              expr: {
                                PLpgSQL_expr: {
                                  query: '0',
                                  parseMode: 2,
                                },
                              },
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      const result = deparseSync(parseResult);
      expect(result).toContain('IF x > 0 THEN');
      expect(result).toContain('RETURN 1');
      expect(result).toContain('ELSE');
      expect(result).toContain('RETURN 0');
      expect(result).toContain('END IF');
    });

    it('should deparse FOR loop', () => {
      const parseResult: PLpgSQLParseResult = {
        plpgsql_funcs: [
          {
            PLpgSQL_function: {
              datums: [
                {
                  PLpgSQL_var: {
                    refname: 'i',
                    lineno: 1,
                    datatype: {
                      PLpgSQL_type: {
                        typname: 'integer',
                      },
                    },
                  },
                },
              ],
              action: {
                PLpgSQL_stmt_block: {
                  lineno: 1,
                  body: [
                    {
                      PLpgSQL_stmt_fori: {
                        lineno: 2,
                        var: {
                          PLpgSQL_var: {
                            refname: 'i',
                            lineno: 2,
                            datatype: {
                              PLpgSQL_type: {
                                typname: 'integer',
                              },
                            },
                          },
                        },
                        lower: {
                          PLpgSQL_expr: {
                            query: '1',
                            parseMode: 2,
                          },
                        },
                        upper: {
                          PLpgSQL_expr: {
                            query: '10',
                            parseMode: 2,
                          },
                        },
                        body: [
                          {
                            PLpgSQL_stmt_raise: {
                              lineno: 3,
                              elog_level: 18,
                              message: 'i = %',
                              params: [
                                {
                                  PLpgSQL_expr: {
                                    query: 'i',
                                    parseMode: 2,
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      const result = deparseSync(parseResult);
      expect(result).toContain('FOR i IN 1..10 LOOP');
      expect(result).toContain('RAISE NOTICE');
      expect(result).toContain('END LOOP');
    });

    it('should deparse WHILE loop', () => {
      const parseResult: PLpgSQLParseResult = {
        plpgsql_funcs: [
          {
            PLpgSQL_function: {
              action: {
                PLpgSQL_stmt_block: {
                  lineno: 1,
                  body: [
                    {
                      PLpgSQL_stmt_while: {
                        lineno: 2,
                        cond: {
                          PLpgSQL_expr: {
                            query: 'x > 0',
                            parseMode: 2,
                          },
                        },
                        body: [
                          {
                            PLpgSQL_stmt_assign: {
                              lineno: 3,
                              varno: 0,
                              expr: {
                                PLpgSQL_expr: {
                                  query: 'x := x - 1',
                                  parseMode: 3,
                                },
                              },
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      const result = deparseSync(parseResult);
      expect(result).toContain('WHILE x > 0 LOOP');
      expect(result).toContain('x := x - 1');
      expect(result).toContain('END LOOP');
    });

    it('should deparse RAISE statement', () => {
      const parseResult: PLpgSQLParseResult = {
        plpgsql_funcs: [
          {
            PLpgSQL_function: {
              action: {
                PLpgSQL_stmt_block: {
                  lineno: 1,
                  body: [
                    {
                      PLpgSQL_stmt_raise: {
                        lineno: 2,
                        elog_level: 21,
                        message: 'Error: %',
                        params: [
                          {
                            PLpgSQL_expr: {
                              query: 'msg',
                              parseMode: 2,
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      const result = deparseSync(parseResult);
      expect(result).toContain('RAISE EXCEPTION');
      expect(result).toContain("'Error: %'");
      expect(result).toContain('msg');
    });
  });

  describe('PLpgSQLDeparser class', () => {
    it('should support lowercase keywords option', () => {
      const parseResult: PLpgSQLParseResult = {
        plpgsql_funcs: [
          {
            PLpgSQL_function: {
              action: {
                PLpgSQL_stmt_block: {
                  lineno: 1,
                  body: [
                    {
                      PLpgSQL_stmt_return: {
                        lineno: 2,
                        expr: {
                          PLpgSQL_expr: {
                            query: '1',
                            parseMode: 2,
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      const deparser = new PLpgSQLDeparser({ uppercase: false });
      const result = deparser.deparseResult(parseResult);
      expect(result).toContain('begin');
      expect(result).toContain('return 1');
      expect(result).toContain('end');
    });

    it('should support custom indentation', () => {
      const parseResult: PLpgSQLParseResult = {
        plpgsql_funcs: [
          {
            PLpgSQL_function: {
              action: {
                PLpgSQL_stmt_block: {
                  lineno: 1,
                  body: [
                    {
                      PLpgSQL_stmt_return: {
                        lineno: 2,
                        expr: {
                          PLpgSQL_expr: {
                            query: '1',
                            parseMode: 2,
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      const deparser = new PLpgSQLDeparser({ indent: '    ' });
      const result = deparser.deparseResult(parseResult);
      expect(result).toContain('    RETURN 1');
    });
  });

  describe('empty results', () => {
    it('should handle empty parse result', () => {
      const parseResult: PLpgSQLParseResult = {
        plpgsql_funcs: [],
      };

      const result = deparseSync(parseResult);
      expect(result).toBe('');
    });
  });
});
