import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to generate package.json files for each version directory
 * Uses version-config.json to map versions to their dependencies
 */

const VERSIONS_DIR = 'versions';
const ROOT_CONFIG_FILE = '../../config/versions.json';
const LOCAL_CONFIG_FILE = 'config/deparser-versions.json';

interface VersionInfo {
  'libpg-query': string;
  'pgsql-parser': string;
  'pgsql-deparser': string | null;
  '@pgsql/types': string;
  npmTag: string;
}

interface RootConfig {
  versions: Record<string, VersionInfo>;
}

interface LocalConfig {
  packageName: string;
  packageTemplate: Record<string, any>;
}

function loadConfigs(): { rootConfig: RootConfig; localConfig: LocalConfig } {
  // Load root versions config
  const rootConfigPath = path.join(__dirname, '..', ROOT_CONFIG_FILE);
  const rootConfigContent = fs.readFileSync(rootConfigPath, 'utf-8');
  const rootConfig: RootConfig = JSON.parse(rootConfigContent);
  
  // Load local package template config
  const localConfigPath = path.join(process.cwd(), LOCAL_CONFIG_FILE);
  const localConfigContent = fs.readFileSync(localConfigPath, 'utf-8');
  const localConfig: LocalConfig = JSON.parse(localConfigContent);
  
  return { rootConfig, localConfig };
}

function generatePackageJson(packageName: string, pgVersion: string, versionInfo: VersionInfo, template: Record<string, any>): any {
  // Start with the template and override only the version-specific fields
  const packageJson: any = {
    ...template,
    name: packageName,
    version: versionInfo['pgsql-deparser'],
    dependencies: {
      [`@pgsql/types`]: `^${versionInfo['@pgsql/types']}`
    }
  };

  packageJson.scripts['publish:pkg'] = `npm publish --tag ${versionInfo.npmTag}`;
  
  return packageJson;
}

function generateTsConfig(): any {
  return {
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
    "include": ["src/**/*.ts"],
    "exclude": ["dist", "node_modules", "**/*.spec.*", "**/*.test.*"]
  };
}

function generateTsConfigEsm(): any {
  return {
    "extends": "./tsconfig.json",
    "compilerOptions": {
      "module": "esnext",
      "outDir": "./dist/esm",
      "declaration": false
    }
  };
}

function generateVersionPackages(): void {
  console.log('Generating package.json files for each version...\n');
  
  const { rootConfig, localConfig } = loadConfigs();
  
  for (const [pgVersion, versionInfo] of Object.entries(rootConfig.versions)) {
    // Skip versions that don't have pgsql-deparser
    if (!versionInfo['pgsql-deparser']) {
      console.log(`Skipping PG${pgVersion} - no pgsql-deparser version available`);
      continue;
    }
    
    console.log(`Processing version ${pgVersion}...`);
    
    const versionDir = path.join(VERSIONS_DIR, pgVersion);
    
    if (!fs.existsSync(versionDir)) {
      console.error(`  ✗ Version directory ${versionDir} does not exist!`);
      continue;
    }
    
    // Generate package.json
    const packageJson = generatePackageJson(localConfig.packageName, pgVersion, versionInfo, localConfig.packageTemplate);
    const packageJsonPath = path.join(versionDir, 'package.json');
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`  ✓ Created package.json`);
    
    // Generate tsconfig.json
    const tsConfig = generateTsConfig();
    const tsConfigPath = path.join(versionDir, 'tsconfig.json');
    fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
    console.log(`  ✓ Created tsconfig.json`);
    
    // Generate tsconfig.esm.json
    const tsConfigEsm = generateTsConfigEsm();
    const tsConfigEsmPath = path.join(versionDir, 'tsconfig.esm.json');
    fs.writeFileSync(tsConfigEsmPath, JSON.stringify(tsConfigEsm, null, 2));
    console.log(`  ✓ Created tsconfig.esm.json`);
    
    // Copy README.md with FOOTER.md appended
    const readmePath = path.join(process.cwd(), 'README.md');
    const footerPath = path.join(__dirname, '../../../FOOTER.md');
    const readmeContent = fs.readFileSync(readmePath, 'utf-8');
    const footerContent = fs.readFileSync(footerPath, 'utf-8');
    const combinedReadme = readmeContent + '\n' + footerContent;
    fs.writeFileSync(path.join(versionDir, 'README.md'), combinedReadme);
    console.log(`  ✓ Created README.md with footer`);
    
    console.log('');
  }
  
  console.log('Done! Package files have been generated for all versions.');
}



// Run the script
generateVersionPackages();