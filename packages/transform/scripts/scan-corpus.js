 
// Coverage audit tool: enumerate every SQL statement node type and PL/pgSQL
// node type present in a generated corpus, with an example file + frequency for
// each. Use it to confirm the transform visitor + round-trip tests
// cover every shape the codegen actually emits before it reaches production.
//
// Usage (from repo root):
//   node packages/transform/scripts/scan-corpus.js \
//     application services pgpm-modules
//
// Writes a machine-readable summary to /tmp/corpus-scan.json. Files that are
// not valid standalone SQL (e.g. compiled sql/<module>--<ver>.sql bundles that
// contain psql meta-commands) are counted under parseErrors and skipped; they
// are not transformer inputs.
const fs = require('fs');
const path = require('path');
const { parseSync, transformSync, loadModule } = require('plpgsql-parser');

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error('usage: node scan-corpus.js <dir> [dir...]');
  process.exit(1);
}

function findSql(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findSql(p, out);
    else if (e.isFile() && e.name.endsWith('.sql')) out.push(p);
  }
}

const sqlTypes = new Map(); // nodeType -> { count, example }
const plTypes = new Map();
let parseErrors = 0;
let hydrateErrors = 0;

function tally(map, key, file) {
  const e = map.get(key) || { count: 0, example: file };
  e.count++;
  map.set(key, e);
}

function tallyPlNode(node, file) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) tallyPlNode(n, file);
    return;
  }
  for (const key of Object.keys(node)) {
    if (key.startsWith('PLpgSQL_')) tally(plTypes, key, file);
    tallyPlNode(node[key], file);
  }
}

function dump(title, map) {
  console.log(`\n=== ${title} (${map.size} distinct) ===`);
  for (const [k, v] of [...map.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`${String(v.count).padStart(8)}  ${k}   e.g. ${v.example.replace(process.env.HOME, '~')}`);
  }
}

async function main() {
  await loadModule();
  const files = [];
  for (const r of roots) findSql(r, files);
  files.sort();
  console.error(`scanning ${files.length} sql files...`);

  let done = 0;
  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf-8');
    let parsed;
    try {
      parsed = parseSync(sql);
    } catch {
      parseErrors++;
      continue;
    }
    const stmts = (parsed.sql && parsed.sql.stmts) || parsed.stmts || [];
    for (const s of stmts) {
      if (s.stmt) tally(sqlTypes, Object.keys(s.stmt)[0], file);
    }
    if (/\bfunction\b|\bprocedure\b|\bdo\b/i.test(sql)) {
      try {
        transformSync(
          sql,
          (ctx) => {
            for (const fn of ctx.functions || []) {
              if (fn.plpgsql && fn.plpgsql.hydrated) tallyPlNode(fn.plpgsql.hydrated, file);
            }
          },
          { hydrate: true }
        );
      } catch {
        hydrateErrors++;
      }
    }
    if (++done % 5000 === 0) console.error(`  ${done}/${files.length}`);
  }

  dump('SQL statement node types', sqlTypes);
  dump('PL/pgSQL node types', plTypes);
  console.log(`\nparseErrors=${parseErrors} hydrateErrors=${hydrateErrors} files=${files.length}`);

  fs.writeFileSync(
    '/tmp/corpus-scan.json',
    JSON.stringify(
      {
        sqlTypes: Object.fromEntries(sqlTypes),
        plTypes: Object.fromEntries(plTypes),
        parseErrors,
        hydrateErrors,
        files: files.length,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
