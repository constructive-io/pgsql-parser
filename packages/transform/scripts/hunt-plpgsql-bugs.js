/* eslint-disable */
// Bug-hunt sweep: run esoteric PL/pgSQL shapes through transformSql with
// roundTrip:true, and also check that key tokens survive in the output.
const { loadModule } = require('plpgsql-parser');
const { transformSql } = require('./dist');

const M = new Map([['my-schema', 'my_schema'], ['other-schema', 'other_schema']]);

const fn = (body, decl = '', ret = 'void', args = '') =>
  `CREATE FUNCTION "my-schema".t(${args}) RETURNS ${ret} AS $$\n${decl ? 'DECLARE\n' + decl + '\n' : ''}BEGIN\n${body}\nEND;\n$$ LANGUAGE plpgsql;`;

const cases = [
  ['labeled block + EXIT label', `CREATE FUNCTION "my-schema".t() RETURNS int AS $$\n<<outer>>\nDECLARE i int := 0;\nBEGIN\n  <<myloop>>\n  LOOP\n    i := i + 1;\n    EXIT myloop WHEN i > 3;\n  END LOOP myloop;\n  RETURN i;\nEND outer;\n$$ LANGUAGE plpgsql;`, ['<<myloop>>', 'EXIT myloop']],
  ['CONTINUE with label', `CREATE FUNCTION "my-schema".t() RETURNS int AS $$\nDECLARE i int; j int; total int := 0;\nBEGIN\n  <<outerloop>>\n  FOR i IN 1..3 LOOP\n    FOR j IN 1..3 LOOP\n      CONTINUE outerloop WHEN j = 2;\n      total := total + 1;\n    END LOOP;\n  END LOOP;\n  RETURN total;\nEND;\n$$ LANGUAGE plpgsql;`, ['CONTINUE outerloop']],
  ['FOR REVERSE with BY', fn(`FOR i IN REVERSE 10..1 BY 2 LOOP\n  PERFORM "my-schema".track(i);\nEND LOOP;`, 'i int;'), ['REVERSE', 'BY 2']],
  ['FOR ... IN EXECUTE dynamic query', fn(`FOR r IN EXECUTE 'SELECT * FROM "my-schema".users' LOOP\n  PERFORM "my-schema".track(r.id);\nEND LOOP;`, 'r record;'), ['EXECUTE']],
  ['FOR ... IN EXECUTE ... USING', fn(`FOR r IN EXECUTE 'SELECT * FROM my_tbl WHERE id = $1' USING 42 LOOP\n  PERFORM "my-schema".track(r.id);\nEND LOOP;`, 'r record;'), ['USING 42']],
  ['EXECUTE INTO STRICT USING', fn(`EXECUTE 'SELECT name FROM tbl WHERE id = $1' INTO STRICT nm USING 7;\nPERFORM "my-schema".log_it(nm);`, 'nm text;'), ['INTO STRICT', 'USING 7']],
  ['SELECT INTO STRICT', fn(`SELECT name INTO STRICT nm FROM "my-schema".users WHERE id = 1;`, 'nm text;'), ['STRICT']],
  ['OPEN cursor FOR EXECUTE', fn(`OPEN c FOR EXECUTE 'SELECT * FROM "my-schema".users';\nCLOSE c;`, 'c refcursor;'), ['OPEN c FOR EXECUTE']],
  ['bound cursor with args', `CREATE FUNCTION "my-schema".t() RETURNS void AS $$\nDECLARE\n  c CURSOR (key int) FOR SELECT * FROM "my-schema".users WHERE id = key;\n  r record;\nBEGIN\n  OPEN c(42);\n  FETCH c INTO r;\n  CLOSE c;\nEND;\n$$ LANGUAGE plpgsql;`, ['CURSOR', 'OPEN c(42)', 'FETCH']],
  ['WHERE CURRENT OF', `CREATE FUNCTION "my-schema".t() RETURNS void AS $$\nDECLARE\n  c CURSOR FOR SELECT * FROM "my-schema".users FOR UPDATE;\nBEGIN\n  OPEN c;\n  MOVE c;\n  UPDATE "my-schema".users SET name = 'x' WHERE CURRENT OF c;\n  CLOSE c;\nEND;\n$$ LANGUAGE plpgsql;`, ['CURRENT OF']],
  ['GET DIAGNOSTICS ROW_COUNT', fn(`UPDATE "my-schema".users SET name = 'x';\nGET DIAGNOSTICS n = ROW_COUNT;\nPERFORM "my-schema".track(n);`, 'n int;'), ['GET DIAGNOSTICS', 'ROW_COUNT']],
  ['RAISE USING ERRCODE/DETAIL/HINT', fn(`RAISE EXCEPTION 'boom %', 1 USING ERRCODE = 'P0001', DETAIL = 'd', HINT = 'h';`), ['USING', 'ERRCODE', 'HINT']],
  ['RAISE SQLSTATE form', fn(`RAISE SQLSTATE '22012';`), ['22012']],
  ['ASSERT with message', fn(`ASSERT (SELECT count(*) FROM "my-schema".users) > 0, 'no users';`), ['ASSERT']],
  ['ALIAS FOR $1', `CREATE FUNCTION "my-schema".t(int) RETURNS int AS $$\nDECLARE\n  arg ALIAS FOR $1;\nBEGIN\n  RETURN arg + 1;\nEND;\n$$ LANGUAGE plpgsql;`, ['ALIAS FOR']],
  ['CONSTANT with DEFAULT', fn(`PERFORM "my-schema".track(lim);`, `lim CONSTANT int DEFAULT 10;`), ['CONSTANT']],
  ['%TYPE and %ROWTYPE', fn(`SELECT id INTO uid FROM "my-schema".users LIMIT 1;\nSELECT * INTO urow FROM "my-schema".users LIMIT 1;`, `uid "my-schema".users.id%TYPE;\nurow "my-schema".users%ROWTYPE;`), ['%TYPE', '%ROWTYPE']],
  ['NOT NULL variable', fn(`PERFORM "my-schema".track(x);`, `x int NOT NULL := 5;`), ['NOT NULL']],
  ['RETURN QUERY', fn(`RETURN QUERY SELECT id FROM "my-schema".users;`, '', 'SETOF uuid'), ['RETURN QUERY']],
  ['RETURN QUERY EXECUTE USING', fn(`RETURN QUERY EXECUTE 'SELECT id FROM "my-schema".users WHERE id = $1' USING 1;`, '', 'SETOF uuid'), ['RETURN QUERY EXECUTE', 'USING 1']],
  ['CASE without ELSE (case_not_found)', fn(`CASE n WHEN 1 THEN PERFORM "my-schema".one(); END CASE;`, 'n int := 1;'), ['END CASE']],
  ['nested exception + RAISE re-raise', fn(`BEGIN\n  PERFORM "my-schema".might_fail();\nEXCEPTION WHEN division_by_zero OR OTHERS THEN\n  RAISE;\nEND;`), ['RAISE']],
  ['SQLSTATE condition in handler', fn(`BEGIN\n  PERFORM "my-schema".might_fail();\nEXCEPTION WHEN SQLSTATE '22P02' THEN\n  PERFORM "my-schema".log_it(SQLERRM);\nEND;`), ['22P02', 'SQLERRM']],
  ['FOREACH SLICE', fn(`FOREACH sl SLICE 1 IN ARRAY arr LOOP\n  PERFORM "my-schema".track(sl[1]);\nEND LOOP;`, 'arr int[][] := ARRAY[[1,2],[3,4]];\nsl int[];'), ['SLICE 1']],
  ['array element assignment', fn(`arr[2] := 5;\narr[1][1] := 6;`, 'arr int[] := ARRAY[1,2,3];'), ['arr[2]']],
  ['record field assignment', fn(`r.name := 'x';\nPERFORM "my-schema".log_it(r.name);`, 'r "my-schema".users%ROWTYPE;'), ['r.name']],
  ['IF / ELSIF / ELSE chain', fn(`IF n = 1 THEN\n  PERFORM "my-schema".one();\nELSIF n = 2 THEN\n  PERFORM "my-schema".two();\nELSIF n = 3 THEN\n  NULL;\nELSE\n  PERFORM "my-schema".many();\nEND IF;`, 'n int := 2;'), ['ELSIF']],
  ['COMMIT/ROLLBACK in procedure', `CREATE PROCEDURE "my-schema".p() AS $$\nBEGIN\n  INSERT INTO "my-schema".users DEFAULT VALUES;\n  COMMIT;\n  INSERT INTO "my-schema".users DEFAULT VALUES;\n  ROLLBACK;\nEND;\n$$ LANGUAGE plpgsql;`, ['COMMIT', 'ROLLBACK']],
  ['CALL another procedure', fn(`CALL "my-schema".p(1, 'x');`), ['CALL']],
  ['ON CONFLICT inside plpgsql', fn(`INSERT INTO "my-schema".users (id, name) VALUES (1, 'a')\nON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;`), ['ON CONFLICT']],
  ['CTE inside plpgsql', fn(`WITH x AS (SELECT id FROM "my-schema".users)\nSELECT count(*) INTO n FROM x;`, 'n int;'), ['WITH x AS']],
  ['GET STACKED DIAGNOSTICS multi', fn(`BEGIN\n  PERFORM "my-schema".might_fail();\nEXCEPTION WHEN OTHERS THEN\n  GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT, det = PG_EXCEPTION_DETAIL, ctx = PG_EXCEPTION_CONTEXT;\n  PERFORM "my-schema".log_it(msg || det || ctx);\nEND;`, 'msg text; det text; ctx text;'), ['PG_EXCEPTION_DETAIL', 'PG_EXCEPTION_CONTEXT']],
  ['EXIT out of block (not loop)', `CREATE FUNCTION "my-schema".t() RETURNS int AS $$\n<<blk>>\nBEGIN\n  IF true THEN\n    EXIT blk;\n  END IF;\n  PERFORM "my-schema".track(1);\n  RETURN 1;\nEND;\n$$ LANGUAGE plpgsql;`, ['EXIT blk']],
  ['RETURN QUERY with window fn', fn(`RETURN QUERY\nSELECT id, row_number() OVER (PARTITION BY name ORDER BY id) FROM "my-schema".users;`, '', 'TABLE(id uuid, rn bigint)'), ['OVER (PARTITION BY']],
  ['dynamic EXECUTE with format()', fn(`EXECUTE format('SELECT count(*) FROM %I.%I', 'my_schema', 'users') INTO n;`, 'n int;'), ['format(']],
  ['WHILE with complex condition', fn(`WHILE n < 10 AND NOT done LOOP\n  n := n + 1;\n  done := n = (SELECT count(*) FROM "my-schema".users);\nEND LOOP;`, 'n int := 0; done boolean := false;'), ['WHILE']],
  ['trigger fn with TG_ vars', `CREATE FUNCTION "my-schema".tg() RETURNS trigger AS $$\nBEGIN\n  IF TG_OP = 'UPDATE' AND OLD.name IS DISTINCT FROM NEW.name THEN\n    NEW.name := lower(NEW.name);\n  END IF;\n  RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;`, ['TG_OP', 'IS DISTINCT FROM']],
];

async function main() {
  await loadModule();
  let fails = 0;
  for (const [name, sql, tokens] of cases) {
    try {
      const { content } = transformSql(sql, M, { roundTrip: true });
      const missing = (tokens || []).filter((t) => !content.includes(t));
      if (missing.length) {
        fails++;
        console.log(`TOKEN-LOSS: ${name} — missing: ${missing.join(' | ')}`);
        console.log('---- output ----\n' + content + '\n----------------');
      } else {
        console.log(`ok: ${name}`);
      }
    } catch (e) {
      fails++;
      console.log(`ROUND-TRIP FAIL: ${name}\n  ${String(e.message).split('\n')[0]}`);
    }
  }
  console.log(`\n${fails} failures / ${cases.length} cases`);
}
main();
