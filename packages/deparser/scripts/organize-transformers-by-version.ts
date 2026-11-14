import * as fs from 'fs';
import * as path from 'path';

/**
 * Copies the stripped transformers each older major needs into versions/<N>/src:
 * the sequential steps from N up to the main deparser's major, plus the direct
 * vN-to-v<TARGET> transformer that chains them.
 */

const VERSIONS_DIR = 'versions';
const SOURCE_VERSIONS = [13, 14, 15, 16, 17];
const TARGET_VERSION = 18;

function copyRequired(sourcePath: string, destPath: string): void {
  if (!fs.existsSync(sourcePath)) {
    console.error(`  ✗ Source file not found: ${sourcePath}`);
    process.exitCode = 1;
    return;
  }
  fs.copyFileSync(sourcePath, destPath);
  console.log(`  ✓ Copied ${path.basename(destPath)}`);
}

function organizeByVersion(): void {
  console.log('Organizing transformers by version...\n');

  for (const version of SOURCE_VERSIONS) {
    console.log(`Processing version ${version}...`);

    const srcDir = path.join(VERSIONS_DIR, version.toString(), 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    for (let from = version; from < TARGET_VERSION; from++) {
      const step = `v${from}-to-v${from + 1}.ts`;
      copyRequired(path.join(VERSIONS_DIR, step), path.join(srcDir, step));
    }

    copyRequired(
      path.join(VERSIONS_DIR, 'direct', `v${version}-to-v${TARGET_VERSION}.ts`),
      path.join(srcDir, `v${version}-to-v${TARGET_VERSION}-direct.ts`)
    );

    console.log('');
  }

  console.log('Done! Transformers are organized in version-specific directories.');
}

organizeByVersion();
