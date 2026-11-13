// Fails when a workspace package that has tests is missing from the CI test matrix.
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');
const workflowPath = '.github/workflows/run-tests.yaml';
const packagesDir = join(root, 'packages');

const hasTests = (dir: string): boolean =>
  readdirSync(dir, { withFileTypes: true }).some(entry => {
    if (entry.name === 'node_modules' || entry.name === 'dist') return false;
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || hasTests(join(dir, entry.name));
    }
    return /\.(test|spec)\.[jt]sx?$/.test(entry.name);
  });

const workflow = readFileSync(join(root, workflowPath), 'utf-8');
const matrixBlock = /^ {8}package:\n((?: {10}- .*\n)+)/m.exec(workflow);
if (!matrixBlock) {
  console.error(`Could not find the package matrix in ${workflowPath}`);
  process.exit(1);
}
const matrix = new Set(
  matrixBlock[1].trim().split('\n').map(line => line.trim().replace(/^- /, '').replace(/^['"]|['"]$/g, ''))
);

const tested = readdirSync(packagesDir)
  .filter(dir => existsSync(join(packagesDir, dir, 'package.json')))
  .filter(dir => hasTests(join(packagesDir, dir)))
  .map(dir => JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf-8')).name as string);

const missing = tested.filter(name => !matrix.has(name));
const stale = [...matrix].filter(name => !tested.includes(name));

for (const name of missing) {
  console.error(`${name} has tests but is not in the package matrix of ${workflowPath}`);
}
for (const name of stale) {
  console.error(`${name} is in the package matrix of ${workflowPath} but is not a workspace package with tests`);
}
if (missing.length || stale.length) {
  process.exit(1);
}
console.log(`CI matrix covers all ${tested.length} packages with tests.`);
