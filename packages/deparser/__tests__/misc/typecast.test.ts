import { expectParseDeparse } from '../../test-utils';

it.each([
  ["CAST('(' AS text)", "'('::text"],
  ["CAST('(-)' AS text)", "'(-)'::text"],
  ["CAST('-hello' AS text)", "'-hello'::text"],
  ['CAST("a(b" AS integer)', '"a(b"::int'],
  ['-1::integer', '- 1::int'],
  ['(-1)::integer', 'CAST(-1 AS int)'],
  ['-1.5::numeric', '- 1.5::numeric'],
  ['(-1.5)::numeric', 'CAST(-1.5 AS numeric)'],
  ['(-0.0)::numeric', 'CAST(-0.0 AS numeric)'],
  ['(-9223372036854775808)::integer', 'CAST(-9223372036854775808 AS int)'],
  ['(1 + 2)::integer', 'CAST(1 + 2 AS int)'],
  ["length('abc')::integer", "(length('abc'))::int"],
  ["'x'::pg_catalog.bpchar", "CAST('x' AS pg_catalog.bpchar)"],
  ["'x'::pg_catalog.bpchar(3)", "CAST('x' AS char(3))"],
  ["'x'::pg_catalog.bpchar[]", "CAST('x' AS pg_catalog.bpchar[])"],
  ["'x'::bpchar", "'x'::bpchar"],
  ["'x'::app.some_type", "CAST('x' AS app.some_type)"],
])('deparses %s without changing the cast AST', async (input, output) => {
  expect(await expectParseDeparse(`SELECT ${input}`)).toBe(`SELECT ${output}`);
});
