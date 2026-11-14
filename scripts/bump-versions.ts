#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';

// Use require to avoid TypeScript type issues with semver
const semver = require('semver') as {
  compare(a: string, b: string): number;
  inc(version: string, release: 'major' | 'minor' | 'patch'): string | null;
  gt(a: string, b: string): boolean;
  valid(version: string): string | null;
};

interface VersionConfig {
  versions: {
    [key: string]: {
      'libpg-query': string;
      'pgsql-parser': string;
      'pgsql-deparser': string | null;
      '@pgsql/types': string;
      npmTag: string;
    };
  };
}

interface PackageVersions {
  'libpg-query': string;
  'pgsql-parser': string;
  'pgsql-deparser': string;
  '@pgsql/types': string;
}

interface TaggedVersions {
  [tag: string]: Partial<PackageVersions>;
}

const CONFIG_PATH = path.join(__dirname, '../config/versions.json');
const PACKAGES = ['libpg-query', 'pgsql-parser', 'pgsql-deparser', '@pgsql/types'] as const;
const BUMPABLE_PACKAGES = ['pgsql-parser', 'pgsql-deparser'] as const;
const READ_ONLY_PACKAGES = ['libpg-query', '@pgsql/types'] as const;

/**
 * Fetch the latest version of a package from npm
 */
async function fetchLatestVersion(packageName: string, tag?: string): Promise<string | null> {
  try {
    const command = tag ? `npm view ${packageName}@${tag} version` : `npm view ${packageName} version`;
    const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', tag ? 'pipe' : 'inherit'] });
    return result.trim();
  } catch (error) {
    if (tag) {
      // If tag-specific fetch fails, don't warn - it might not exist
      return null;
    }
    console.warn(`⚠️  Could not fetch latest version for ${packageName}:`, (error as Error).message);
    return null;
  }
}

/**
 * Fetch latest versions for all packages
 */
async function fetchAllLatestVersions(): Promise<Partial<PackageVersions>> {
  console.log('🔍 Fetching latest package versions from npm...\n');
  
  const versions: Partial<PackageVersions> = {};
  
  for (const pkg of PACKAGES) {
    process.stdout.write(`  Fetching ${pkg}... `);
    const version = await fetchLatestVersion(pkg);
    if (version) {
      versions[pkg as keyof PackageVersions] = version;
      console.log(`✅ ${version}`);
    } else {
      console.log(`❌ Failed`);
    }
  }
  
  console.log();
  return versions;
}

/**
 * Fetch tag-specific versions for packages
 */
async function fetchTaggedVersions(tags: string[]): Promise<TaggedVersions> {
  console.log('🏷️  Fetching tag-specific versions...\n');
  
  const taggedVersions: TaggedVersions = {};
  
  for (const tag of tags) {
    taggedVersions[tag] = {};
    console.log(`  Tag: ${tag}`);
    
    for (const pkg of PACKAGES) {
      process.stdout.write(`    ${pkg}... `);
      const version = await fetchLatestVersion(pkg, tag);
      if (version) {
        taggedVersions[tag][pkg as keyof PackageVersions] = version;
        console.log(`✅ ${version}`);
      } else {
        console.log(`❌ Not found`);
      }
    }
  }
  
  console.log();
  return taggedVersions;
}

/**
 * Create readline interface for user input
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt user for input
 */
function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

/**
 * Display current vs latest versions for a package
 */
function displayVersionComparison(packageName: string, current: string | null, latest: string | null): void {
  const currentStr = current || 'null';
  const latestStr = latest || 'unknown';
  const isReadOnly = READ_ONLY_PACKAGES.includes(packageName as any);
  
  if (!current || !latest) {
    const readOnlyTag = isReadOnly ? ' (read-only)' : '';
    console.log(`  ${packageName}: ${currentStr} → ${latestStr}${readOnlyTag}`);
    return;
  }
  
  const comparison = semver.compare(current, latest);
  let arrow = '→';
  let status = '';
  
  if (comparison < 0) {
    arrow = '🔼';
    status = ' (outdated)';
  } else if (comparison > 0) {
    arrow = '🔽';
    status = ' (ahead)';
  } else {
    arrow = '✅';
    status = ' (current)';
  }
  
  const readOnlyTag = isReadOnly ? ' [read-only]' : '';
  console.log(`  ${packageName}: ${currentStr} ${arrow} ${latestStr}${status}${readOnlyTag}`);
}

/**
 * Get semver bump options for a version
 */
function getBumpOptions(currentVersion: string | null, latestVersion: string | null, packageName: string): string[] {
  if (!currentVersion) {
    return latestVersion ? [latestVersion] : [];
  }
  
  // For bumpable packages (pgsql-parser, pgsql-deparser), only allow minor and patch
  const isBumpable = BUMPABLE_PACKAGES.includes(packageName as any);
  
  const options = [];
  
  if (isBumpable) {
    options.push(
      `patch (${semver.inc(currentVersion, 'patch')})`,
      `minor (${semver.inc(currentVersion, 'minor')})`
    );
    // No major version bumps for pgsql-parser and pgsql-deparser
  } else {
    // For read-only packages, we shouldn't get here, but just in case
    return ['skip'];
  }
  
  if (latestVersion && semver.gt(latestVersion, currentVersion)) {
    // For bumpable packages, only show latest if it's not a major bump
    if (isBumpable) {
      const currentMajor = parseInt(currentVersion.split('.')[0]);
      const latestMajor = parseInt(latestVersion.split('.')[0]);
      if (latestMajor <= currentMajor) {
        options.unshift(`latest (${latestVersion})`);
      }
    } else {
      options.unshift(`latest (${latestVersion})`);
    }
  }
  
  options.push(`custom`, `skip`);
  
  return options;
}

/**
 * Prompt user to select version bump type
 */
async function promptVersionBump(
  rl: readline.Interface,
  packageName: string,
  currentVersion: string | null,
  latestVersion: string | null
): Promise<string | null> {
  // Skip read-only packages
  if (READ_ONLY_PACKAGES.includes(packageName as any)) {
    return null;
  }
  
  const options = getBumpOptions(currentVersion, latestVersion, packageName);
  
  if (options.length === 0) {
    return null;
  }
  
  console.log(`\n📦 ${packageName}:`);
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });
  
  while (true) {
    const choice = await prompt(rl, `Select option (1-${options.length}): `);
    const index = parseInt(choice) - 1;
    
    if (index >= 0 && index < options.length) {
      const selectedOption = options[index];
      
      if (selectedOption === 'skip') {
        return null;
      }
      
      if (selectedOption === 'custom') {
        const customVersion = await prompt(rl, 'Enter custom version: ');
        if (semver.valid(customVersion)) {
          // For bumpable packages, ensure custom version doesn't bump major
          if (BUMPABLE_PACKAGES.includes(packageName as any) && currentVersion) {
            const currentMajor = parseInt(currentVersion.split('.')[0]);
            const customMajor = parseInt(customVersion.split('.')[0]);
            if (customMajor > currentMajor) {
              console.log('❌ Major version bumps are not allowed for this package. Please use minor or patch bumps only.');
              continue;
            }
          }
          return customVersion;
        } else {
          console.log('❌ Invalid semver version. Please try again.');
          continue;
        }
      }
      
      // Extract version from option string
      const match = selectedOption.match(/\(([^)]+)\)/);
      if (match) {
        return match[1];
      }
      
      // Handle "latest" case
      if (selectedOption.startsWith('latest') && latestVersion) {
        // Check if latest would be a major bump
        if (BUMPABLE_PACKAGES.includes(packageName as any) && currentVersion) {
          const currentMajor = parseInt(currentVersion.split('.')[0]);
          const latestMajor = parseInt(latestVersion.split('.')[0]);
          if (latestMajor > currentMajor) {
            console.log('⚠️  Latest version would be a major bump. Skipping for this package.');
            return null;
          }
        }
        return latestVersion;
      }
    }
    
    console.log('❌ Invalid choice. Please try again.');
  }
}

/**
 * Process version bumps for a specific PostgreSQL version
 */
async function processVersionBumps(
  rl: readline.Interface,
  pgVersion: string,
  currentVersions: VersionConfig['versions'][string],
  latestVersions: Partial<PackageVersions>,
  taggedVersions: TaggedVersions
): Promise<VersionConfig['versions'][string]> {
  console.log(`\n🔧 Processing PostgreSQL ${pgVersion} (${currentVersions.npmTag}):`);
  console.log('━'.repeat(50));
  
  // Display current vs latest
  for (const pkg of PACKAGES) {
    const current = pkg === 'pgsql-deparser' ? currentVersions[pkg] : currentVersions[pkg as keyof typeof currentVersions];
    // Prefer the version on this major's dist-tag
    let latest: string | null = null;
    if (taggedVersions[currentVersions.npmTag]) {
      latest = taggedVersions[currentVersions.npmTag][pkg as keyof PackageVersions] || null;
    }
    // Fall back to global latest if no tag-specific version
    if (!latest) {
      latest = latestVersions[pkg as keyof PackageVersions] || null;
    }
    displayVersionComparison(pkg, current, latest);
  }
  
  const updatedVersions = { ...currentVersions };
  
  // Process each package
  for (const pkg of PACKAGES) {
    const current = pkg === 'pgsql-deparser' ? currentVersions[pkg] : currentVersions[pkg as keyof typeof currentVersions];
    
    // Prefer the version on this major's dist-tag
    let latest: string | null = null;
    if (taggedVersions[currentVersions.npmTag]) {
      latest = taggedVersions[currentVersions.npmTag][pkg as keyof PackageVersions] || null;
    }
    // Fall back to global latest if no tag-specific version
    if (!latest) {
      latest = latestVersions[pkg as keyof PackageVersions] || null;
    }
    
    // Read-only packages are published elsewhere: pin whatever this major's dist-tag points at
    if (READ_ONLY_PACKAGES.includes(pkg as any)) {
      const tagged = taggedVersions[currentVersions.npmTag]?.[pkg as keyof PackageVersions];
      if (tagged && tagged !== current) {
        (updatedVersions as any)[pkg] = tagged;
        console.log(`\n📦 ${pkg}: ${current || 'null'} → ${tagged} [follows the ${currentVersions.npmTag} dist-tag]`);
      } else {
        console.log(`\n📦 ${pkg}: ${current || 'null'} [follows the ${currentVersions.npmTag} dist-tag - unchanged]`);
      }
      continue;
    }
    
    const newVersion = await promptVersionBump(rl, pkg, current, latest);
    
    if (newVersion) {
      if (pkg === 'pgsql-deparser') {
        updatedVersions[pkg] = newVersion;
      } else {
        (updatedVersions as any)[pkg] = newVersion;
      }
      console.log(`✅ ${pkg}: ${current} → ${newVersion}`);
    } else {
      console.log(`⏭️  ${pkg}: keeping ${current || 'null'}`);
    }
  }
  
  return updatedVersions;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('🚀 PostgreSQL Package Version Bumper\n');
  
  // Read current config
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ Config file not found: ${CONFIG_PATH}`);
    process.exit(1);
  }
  
  const config: VersionConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  
  // Fetch latest versions
  const latestVersions = await fetchAllLatestVersions();
  
  // Get unique npm tags from config
  const npmTags = [...new Set(Object.values(config.versions).map(v => v.npmTag))];
  
  // Fetch tag-specific versions
  const taggedVersions = await fetchTaggedVersions(npmTags);
  
  // Create readline interface
  const rl = createReadlineInterface();
  
  try {
    const updatedConfig: VersionConfig = { versions: {} };
    
    // Process each PostgreSQL version
    const pgVersions = Object.keys(config.versions).sort();
    
    for (const pgVersion of pgVersions) {
      const currentVersions = config.versions[pgVersion];
      const updatedVersions = await processVersionBumps(
        rl,
        pgVersion,
        currentVersions,
        latestVersions,
        taggedVersions
      );
      updatedConfig.versions[pgVersion] = updatedVersions;
    }
    
    // Show summary
    console.log('\n📋 Summary of Changes:');
    console.log('━'.repeat(50));
    
    let hasChanges = false;
    for (const pgVersion of pgVersions) {
      const current = config.versions[pgVersion];
      const updated = updatedConfig.versions[pgVersion];
      
      const changes: string[] = [];
      for (const pkg of PACKAGES) {
        const currentVal = pkg === 'pgsql-deparser' ? current[pkg] : current[pkg as keyof typeof current];
        const updatedVal = pkg === 'pgsql-deparser' ? updated[pkg] : updated[pkg as keyof typeof updated];
        
        if (currentVal !== updatedVal) {
          changes.push(`${pkg}: ${currentVal} → ${updatedVal}`);
          hasChanges = true;
        }
      }
      
      if (changes.length > 0) {
        console.log(`\nPG${pgVersion}:`);
        changes.forEach(change => console.log(`  ${change}`));
      }
    }
    
    if (!hasChanges) {
      console.log('No changes made.');
      return;
    }
    
    // Confirm save
    const shouldSave = await prompt(rl, '\n💾 Save changes to config/versions.json? (y/N): ');
    
    if (shouldSave.toLowerCase() === 'y' || shouldSave.toLowerCase() === 'yes') {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(updatedConfig, null, 2) + '\n');
      console.log('✅ Configuration saved successfully!');
    } else {
      console.log('❌ Changes discarded.');
    }
    
  } finally {
    rl.close();
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

export { main };