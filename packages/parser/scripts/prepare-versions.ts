import * as fs from 'fs';
import * as path from 'path';

// Read the versions configuration from root
const rootConfigPath = path.join(__dirname, '../../../config/versions.json');
const rootConfig = JSON.parse(fs.readFileSync(rootConfigPath, 'utf-8'));

// Read the package.json template
const templatePath = path.join(__dirname, '../config/package.template.json');
const packageTemplate = fs.readFileSync(templatePath, 'utf-8');

// Create versions directory if it doesn't exist
const versionsDir = path.join(__dirname, '../versions');
if (!fs.existsSync(versionsDir)) {
  fs.mkdirSync(versionsDir, { recursive: true });
}

// Generate version-specific packages
const pgVersions = Object.keys(rootConfig.versions);

pgVersions.forEach(pgVersion => {
  const versionInfo = rootConfig.versions[pgVersion];
  
  // Skip if no libpg-query or pgsql-parser version available
  if (!versionInfo['libpg-query'] || !versionInfo['pgsql-parser']) {
    console.log(`Skipping PG${pgVersion} - missing libpg-query or pgsql-parser version`);
    return;
  }
  
  const libpgQueryVersion = versionInfo['libpg-query'];
  const pgsqlParserVersion = versionInfo['pgsql-parser'];
  const pgsqlDeparserVersion = versionInfo['pgsql-deparser'];
  const typesVersion = versionInfo['@pgsql/types'];
  const npmTag = versionInfo['npmTag'];

  // Create version directory
  const versionDir = path.join(versionsDir, `${pgVersion}`);
  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }

  // Create src directory
  const srcDir = path.join(versionDir, 'src');
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  // Generate package.json
  const packageJson = packageTemplate
    .replace(/{{LIBPG_QUERY_VERSION}}/g, libpgQueryVersion)
    .replace(/{{VERSION_TAG}}/g, `${npmTag}`)
    .replace(/{{TYPES_VERSION}}/g, typesVersion)
    .replace(/{{PGSQL_DEPARSER_VERSION}}/g, pgsqlDeparserVersion)
    .replace(/{{PGSQL_PARSER_VERSION}}/g, pgsqlParserVersion);

  fs.writeFileSync(
    path.join(versionDir, 'package.json'),
    packageJson
  );

  // Generate index.ts
  const indexContent = `export {
  parse as parse,
  parseSync as parseSync,
  loadModule as loadModule
} from 'libpg-query';

export {
  deparse,
  deparseSync,
} from 'pgsql-deparser';

export * from '@pgsql/types';
`;

  fs.writeFileSync(
    path.join(srcDir, 'index.ts'),
    indexContent
  );

  fs.writeFileSync(path.join(versionDir, 'tsconfig.json'), JSON.stringify({
    "compilerOptions": {
      "outDir": "dist",
      "rootDir": "src/",
      "target": "es2022",
      "module": "commonjs",
      "esModuleInterop": true,
      "forceConsistentCasingInFileNames": true,
      "strict": true,
      "strictNullChecks": false,
      "skipLibCheck": true,
      "sourceMap": false,
      "declaration": true,
      "resolveJsonModule": true,
      "moduleResolution": "node"
    },
    "include": [
      "src/**/*.ts"
    ],
    "exclude": [
      "dist",
      "node_modules",
      "**/*.spec.*",
      "**/*.test.*"
    ]
  }, null, 2));


  fs.writeFileSync(path.join(versionDir, 'tsconfig.esm.json'), JSON.stringify({
    "extends": "./tsconfig.json",
    "compilerOptions": {
      "outDir": "dist/esm",
      "module": "es2022",
      "rootDir": "src/",
      "declaration": false
    }
  }, null, 2));


  // Copy the README.md files with FOOTER.md appended
  const readmeContent = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf-8');
  const footerContent = fs.readFileSync(path.join(__dirname, '../../../FOOTER.md'), 'utf-8');
  const combinedReadme = readmeContent + '\n' + footerContent;
  fs.writeFileSync(path.join(versionDir, 'README.md'), combinedReadme);

  console.log(`✓ Generated PG${pgVersion} with libpg-query@${libpgQueryVersion} and pgsql-parser@${pgsqlParserVersion}`);
});

console.log('\nVersion preparation complete!');