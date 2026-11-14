import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to generate deparser index files for each version
 * Creates index.ts files that use transformers to provide deparse functionality
 */

interface VersionConfig {
  version: number;
  directTransformerClass: string;
  directTransformerFile: string;
}

const VERSIONS_DIR = 'versions';

// The main deparser speaks the PG18 AST, so every older major is upgraded to 18 first.
const versionConfigs: VersionConfig[] = [13, 14, 15, 16, 17].map(version => ({
  version,
  directTransformerClass: `PG${version}ToPG18Transformer`,
  directTransformerFile: `./v${version}-to-v18-direct`
}));

// Spellings the PG18 deparser prints that an older server cannot parse back to the same AST.
// They are corrected here, in the generated package only, so the PG18 output is left alone.

// PG13-16: the 16->17 upgrade qualifies a bare json type as pg_catalog.json, as the PG17 parser does
const KEEP_BARE_JSON_TYPE = `
const bare = (names: any, name: string): boolean =>
  Array.isArray(names) && names.length === 1 && (names[0]?.String?.sval ?? names[0]?.String?.str) === name;

const v16to17 = (tx as any).v16to17;
const upgradeTypeName = v16to17.TypeName.bind(v16to17);
v16to17.TypeName = (node: any, context: any) => {
  const out = upgradeTypeName(node, context);
  if (bare(node.names, 'json')) out.TypeName.names = [{ String: { sval: 'json' } }];
  return out;
};
const upgradeTypeCast = v16to17.TypeCast.bind(v16to17);
v16to17.TypeCast = (node: any, context: any) => {
  const out = upgradeTypeCast(node, context);
  const typeName = out.TypeCast.typeName?.TypeName ?? out.TypeCast.typeName;
  if (typeName && bare((node.typeName?.TypeName ?? node.typeName)?.names, 'json')) {
    typeName.names = [{ String: { sval: 'json' } }];
  }
  return out;
};
`;

// PG13-15: the 15->16 upgrade qualifies json_object() as pg_catalog.json_object(), as the PG16 parser does
const KEEP_BARE_JSON_OBJECT = `
const v15to16 = (tx as any).v15to16;
const upgradeFuncCall = v15to16.FuncCall.bind(v15to16);
v15to16.FuncCall = (node: any, context: any) => {
  const out = upgradeFuncCall(node, context);
  if (out.FuncCall && bare(node.funcname, 'json_object')) {
    out.FuncCall.funcname = [{ String: { sval: 'json_object' } }];
  }
  return out;
};
`;

// PG13-16: ALTER OPERATOR ... SET (RESTRICT = NONE) needs the explicit NONE before PG17
const OPERATOR_OPTION_NONE = `
  DefElem(node: any, context: any): string {
    if (!node.arg && node.defaction !== 'DEFELEM_DROP' && context.parentNodeTypes.includes('AlterOperatorStmt')) {
      return \`\${node.defname} = NONE\`;
    }
    return super.DefElem(node, context);
  }
`;

// PG13-15: GRANT role ... WITH ADMIN OPTION is the only spelling before PG16
const GRANT_ROLE_ADMIN_OPTION = `
  GrantRoleStmt(node: any, context: any): string {
    const sql = super.GrantRoleStmt(node, context);
    const opts = (Array.isArray(node.opt) ? node.opt : []).map((opt: any) => opt.DefElem);
    const arg = opts[0]?.arg;
    const off = arg?.Boolean ? arg.Boolean.boolval !== true : arg?.String?.sval === 'false';
    if (!node.is_grant || opts.length !== 1 || opts[0]?.defname !== 'admin' || off) return sql;
    // locate the option by what the statement prints without GRANTED BY, so a role name can never match
    const head = node.grantor ? super.GrantRoleStmt({ ...node, grantor: undefined }, context) : sql;
    const option = ' WITH ADMIN TRUE';
    if (!head.endsWith(option) || !sql.startsWith(head)) return sql;
    return head.slice(0, -option.length) + ' WITH ADMIN OPTION' + sql.slice(head.length);
  }
`;

// PG13: every substring() spelling parses to pg_catalog.substring(), which only the SQL form prints back
const KEEP_CATALOG_SUBSTRING = `
const v13to14 = (tx as any).v13to14;
const upgradeSubstring = v13to14.FuncCall.bind(v13to14);
v13to14.FuncCall = (node: any, context: any) => {
  const out = upgradeSubstring(node, context);
  const [schema, name] = (node.funcname ?? []).map((part: any) => part?.String?.str ?? part?.String?.sval);
  const argCount = node.args?.length;
  if (out.FuncCall && node.funcname?.length === 2 && schema === 'pg_catalog' && name === 'substring' && (argCount === 2 || argCount === 3)) {
    out.FuncCall.funcname = [{ String: { sval: 'pg_catalog' } }, { String: { sval: 'substring' } }];
    out.FuncCall.funcformat = 'COERCE_SQL_SYNTAX';
  }
  return out;
};
`;

// PG13: REINDEX takes CONCURRENTLY after the object kind, not in the option list
const REINDEX_CONCURRENTLY = `
  ReindexStmt(node: any, context: any): string {
    const params = Array.isArray(node.params) ? node.params : [];
    const others = params.filter((param: any) => param?.DefElem?.defname !== 'concurrently');
    if (others.length === params.length) return super.ReindexStmt(node, context);
    return super
      .ReindexStmt({ ...node, params: others }, context)
      .replace(/^REINDEX( \\([^)]*\\))? (INDEX|TABLE|SCHEMA|SYSTEM|DATABASE)/, match => \`\${match} CONCURRENTLY\`);
  }
`;

// PG13-14: a publication lists tables as TABLE a, b; repeating TABLE per object is PG15 syntax
const PUBLICATION_TABLE_LIST = `
  private publicationTableListed = false;

  CreatePublicationStmt(node: any, context: any): string {
    this.publicationTableListed = false;
    return super.CreatePublicationStmt(node, context);
  }

  AlterPublicationStmt(node: any, context: any): string {
    this.publicationTableListed = false;
    return super.AlterPublicationStmt(node, context);
  }

  PublicationObjSpec(node: any, context: any): string {
    const sql = super.PublicationObjSpec(node, context);
    if (node.pubobjtype !== 'PUBLICATIONOBJ_TABLE') return sql;
    const first = !this.publicationTableListed;
    this.publicationTableListed = true;
    return first ? sql : sql.replace(/^TABLE /, '');
  }
`;

function generateDeparserIndex(config: VersionConfig): string {
  const { version } = config;
  const upgradePatches = [
    version <= 16 ? KEEP_BARE_JSON_TYPE : '',
    version <= 15 ? KEEP_BARE_JSON_OBJECT : '',
    version <= 13 ? KEEP_CATALOG_SUBSTRING : ''
  ].join('');
  const deparserOverrides = [
    version <= 16 ? OPERATOR_OPTION_NONE : '',
    version <= 15 ? GRANT_ROLE_ADMIN_OPTION : '',
    version <= 14 ? PUBLICATION_TABLE_LIST : '',
    version <= 13 ? REINDEX_CONCURRENTLY : ''
  ].join('');

  return `/**
 * Deparser for PostgreSQL version ${version}
 * Auto-generated by generate-version-deparsers.ts
 */

import { Node, ParseResult } from '@pgsql/types';
import { Deparser as Deparser18, DeparserOptions } from './deparser';
import { ${config.directTransformerClass} } from '${config.directTransformerFile}';

const tx = new ${config.directTransformerClass}();
${upgradePatches}
type Query = Node | Node[] | ParseResult;

const toAst18 = (query: Query): any =>
  Array.isArray(query) ? query.map(node => tx.transform(node)) : tx.transform(query);

export class Deparser extends Deparser18 {
  constructor(tree: Query, opts: DeparserOptions = {}) {
    super(toAst18(tree), opts);
  }

  static deparse(query: Query, opts: DeparserOptions = {}): string {
    return new Deparser(query, opts).deparseQuery();
  }
${deparserOverrides}}

export async function deparse(query: Query, opts?: DeparserOptions): Promise<string> {
  return Deparser.deparse(query, opts);
}

export function deparseSync(query: Query, opts?: DeparserOptions): string {
  return Deparser.deparse(query, opts);
}

export { DeparserOptions };
export { splitSqlLines } from './deparser/utils/sql-formatter';
export { QuoteUtils } from '@pgsql/quotes';
`;
}

function updateVersionDirectory(config: VersionConfig): void {
  const versionDir = path.join(VERSIONS_DIR, config.version.toString());
  
  if (!fs.existsSync(versionDir)) {
    console.error(`Version directory ${versionDir} does not exist!`);
    process.exitCode = 1;
    return;
  }

  // Create src directory if it doesn't exist
  const srcDir = path.join(versionDir, 'src');
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  // Generate new index.ts in src directory
  const indexContent = generateDeparserIndex(config);
  const indexPath = path.join(srcDir, 'index.ts');
  fs.writeFileSync(indexPath, indexContent);
  console.log(`  ✓ Created index.ts with deparser functionality`);
}



function main(): void {
  console.log('Generating version-specific deparsers...\n');

  for (const config of versionConfigs) {
    console.log(`Processing version ${config.version}...`);
    updateVersionDirectory(config);

    console.log('');
  }

  console.log('Done! Version-specific deparsers have been generated.');
}

// Run the script
main();