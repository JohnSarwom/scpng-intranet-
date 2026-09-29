const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const helperPath = path.resolve(__dirname, '../utils/latestRevision.ts');
const hooksPath = path.resolve(__dirname, '../hooks/useSharePointOps.ts');

function loadHelper() {
  const output = ts.transpileModule(fs.readFileSync(helperPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports });
  return module.exports.latestKnownRevision;
}

const latestKnownRevision = loadHelper();

test('the query cache wins over an older closure snapshot', () => {
  const closureSnapshot = [{ id: '626', revision: '"task,1"' }];
  const cacheAfterFirstSave = [{ id: '626', revision: '"task,2"' }];
  assert.equal(latestKnownRevision('626', cacheAfterFirstSave, closureSnapshot), '"task,2"');
});

test('a follow-up save after a dialog save uses the new version, not the one the closure captured', () => {
  // Reproduces the preview failure on task 626: the dialog save moved the task to
  // version 2, then the assignment follow-up ran from the old closure.
  let cache = [{ id: 626, revision: '"task,1"' }];
  const closureSnapshot = cache;
  const serverRevision = () => '"task,2"';

  cache = [{ id: 626, revision: serverRevision() }]; // first save returns and updates the cache

  const expected = latestKnownRevision(626, cache, closureSnapshot);
  assert.equal(expected, serverRevision(), 'second save must send the version the server now holds');
});

test('falls back to the closure snapshot when the cache has not been filled', () => {
  assert.equal(latestKnownRevision('7', undefined, [{ id: 7, revision: '"kpi,4"' }]), '"kpi,4"');
});

test('ids compare as text, and a record without a revision is skipped', () => {
  assert.equal(latestKnownRevision(12, [{ id: '12' }], [{ id: 12, revision: '"kra,3"' }]), '"kra,3"');
  assert.equal(latestKnownRevision('99', [{ id: '1', revision: '"x,1"' }]), undefined);
});

test('every save and delete in the SharePoint hooks reads the latest cached version', () => {
  const hooks = fs.readFileSync(hooksPath, 'utf8');
  assert.equal(hooks.includes('current?.revision'), false, 'no hook may take a revision from a stale closure');
  const uses = hooks.match(/latestKnownRevision\(id, queryClient\.getQueryData</g) || [];
  assert.equal(uses.length, 8, 'objectives, KRAs, KPIs and tasks each resolve update and delete revisions from the cache');
});
