import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const baselinePath = resolve('docs', 'strategy-execution', 'handoff-evidence', 'phase4f-release-typecheck.json');
const tscPath = resolve('node_modules', 'typescript', 'bin', 'tsc');
const diagnosticPattern = /^(.*?\.tsx?)\(\d+,\d+\): error (TS\d+): (.*)$/gm;
const writeBaseline = process.argv.includes('--write-baseline');

function normalizeDiagnostic(value) {
  return value
    .replaceAll('\\', '/')
    .replace(/import\("[^"]*\/src\//gi, 'import("<repo>/src/');
}

function diagnosticSet(output) {
  const diagnostics = new Set();
  for (const match of output.matchAll(diagnosticPattern)) {
    const file = match[1].replaceAll('\\', '/').toLowerCase();
    diagnostics.add(normalizeDiagnostic(`${file}|${match[2]}|${match[3].trim()}`));
  }
  return diagnostics;
}

function difference(left, right) {
  return [...left].filter(item => !right.has(item)).sort();
}

const result = spawnSync(process.execPath, [tscPath, '-p', 'tsconfig.app.json', '--noEmit', '--pretty', 'false'], {
  encoding: 'utf8',
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

const output = `${result.stdout || ''}${result.stderr || ''}`;
const current = diagnosticSet(output);
if ((result.status ?? 1) !== 0 && current.size === 0) {
  console.error('TypeScript failed without producing recognizable diagnostics.');
  console.error(output.trim());
  process.exit(1);
}

if (writeBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify({
    baselineVersion: 1,
    source: 'isolated staged strategy release candidate',
    diagnosticCount: current.size,
    diagnostics: [...current].sort(),
  }, null, 2)}\n`);
  console.log(`Wrote ${current.size} unique TypeScript diagnostics to ${baselinePath}.`);
  process.exit(0);
}

let baselineDocument;
try {
  baselineDocument = JSON.parse(readFileSync(baselinePath, 'utf8'));
} catch (error) {
  console.error(`Unable to read the TypeScript baseline at ${baselinePath}: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

if (baselineDocument?.baselineVersion !== 1 || !Array.isArray(baselineDocument.diagnostics)) {
  console.error(`The TypeScript baseline at ${baselinePath} is invalid.`);
  process.exit(1);
}
const baseline = new Set(baselineDocument.diagnostics.map(normalizeDiagnostic));
if (baseline.size === 0 || baseline.size !== baselineDocument.diagnosticCount) {
  console.error(`The TypeScript baseline at ${baselinePath} is empty or internally inconsistent.`);
  process.exit(1);
}

const added = difference(current, baseline);
const resolved = difference(baseline, current);

console.log(`TypeScript baseline: ${baseline.size} unique diagnostics.`);
console.log(`TypeScript current: ${current.size} unique diagnostics.`);
console.log(`Resolved baseline diagnostics: ${resolved.length}.`);

if (added.length > 0) {
  console.error(`New TypeScript diagnostics: ${added.length}.`);
  for (const diagnostic of added) console.error(`  ${diagnostic}`);
  process.exit(1);
}

console.log('No new TypeScript diagnostics were introduced.');
