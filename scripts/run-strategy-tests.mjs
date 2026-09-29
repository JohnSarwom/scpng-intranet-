import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const testsDirectory = resolve('src', 'tests');
const testFiles = readdirSync(testsDirectory)
  .filter(file => file.endsWith('.test.cjs'))
  .sort()
  .map(file => resolve(testsDirectory, file));

if (testFiles.length === 0) {
  console.error('No strategy execution .test.cjs files were found.');
  process.exit(1);
}

console.log(`Running ${testFiles.length} strategy execution test suites.`);
const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
