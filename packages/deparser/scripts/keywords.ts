import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function requireNonEmpty(value: string | undefined, label: string): string {
  if (!value) {
    console.error(`❌ Missing ${label}.`);
    process.exit(1);
  }
  return value;
}

function expandTilde(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(process.env.HOME || "", p.slice(2));
  }
  return p;
}

async function main() {
  const [, , kwlistArg, outArg] = process.argv;

  // kwlist.h path is required (CLI arg or prompt), output defaults to src/kwlist.ts
  let kwlistPathInput = kwlistArg;
  if (!kwlistPathInput) {
    console.log("e.g. ~/code/postgres/postgres/src/include/parser/kwlist.h");
    kwlistPathInput = requireNonEmpty(await ask("Path to PostgreSQL kwlist.h"), "kwlist.h path");
  }

  const outPathInput = outArg ?? path.resolve(__dirname, "../src/kwlist.ts");

  const kwlistPath = path.resolve(expandTilde(kwlistPathInput));
  const outPath = path.resolve(outPathInput);

  if (!fs.existsSync(kwlistPath)) {
    console.error(`❌ kwlist.h not found: ${kwlistPath}`);
    process.exit(1);
  }

  const src = fs.readFileSync(kwlistPath, "utf8");

  // PG_KEYWORD("word", TOKEN, KIND_KEYWORD, ...)
  const re = /^PG_KEYWORD\("([^"]+)",\s*[^,]+,\s*([A-Z_]+)_KEYWORD\b/gm;

  const kinds = new Map<string, Set<string>>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const word = m[1].toLowerCase();
    const kind = `${m[2]}_KEYWORD`;

    if (!kinds.has(kind)) kinds.set(kind, new Set());
    kinds.get(kind)!.add(word);
  }

  // Stable, sorted output
  const keywordsByKind: Record<string, string[]> = {};
  for (const [kind, set] of kinds.entries()) {
    keywordsByKind[kind] = [...set].sort();
  }

  const ts = `/* eslint-disable */
/**
 * Generated from PostgreSQL kwlist.h
 * DO NOT EDIT BY HAND.
 */

export type KeywordKind =
  | "NO_KEYWORD"
  | "UNRESERVED_KEYWORD"
  | "COL_NAME_KEYWORD"
  | "TYPE_FUNC_NAME_KEYWORD"
  | "RESERVED_KEYWORD";

export const kwlist = ${JSON.stringify(keywordsByKind, null, 2)
    .replace(/"([A-Z_]+)"/g, "$1")} as const;

export const RESERVED_KEYWORDS = new Set(kwlist.RESERVED_KEYWORD ?? []);
export const UNRESERVED_KEYWORDS = new Set(kwlist.UNRESERVED_KEYWORD ?? []);
export const COL_NAME_KEYWORDS = new Set(kwlist.COL_NAME_KEYWORD ?? []);
export const TYPE_FUNC_NAME_KEYWORDS = new Set(kwlist.TYPE_FUNC_NAME_KEYWORD ?? []);

export function keywordKindOf(word: string): KeywordKind {
  const w = word.toLowerCase();
  if (RESERVED_KEYWORDS.has(w)) return "RESERVED_KEYWORD";
  if (TYPE_FUNC_NAME_KEYWORDS.has(w)) return "TYPE_FUNC_NAME_KEYWORD";
  if (COL_NAME_KEYWORDS.has(w)) return "COL_NAME_KEYWORD";
  if (UNRESERVED_KEYWORDS.has(w)) return "UNRESERVED_KEYWORD";
  return "NO_KEYWORD";
}
`;

  fs.writeFileSync(outPath, ts, "utf8");
  console.log(`✅ Wrote ${outPath}`);
  console.log(`   Source: ${kwlistPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
