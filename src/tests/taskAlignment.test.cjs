const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const filename = path.resolve(__dirname, file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInThisContext(`(function(exports) { ${code}\n})`, { filename })(exports);
  return exports;
}

const {
  OPERATIONAL_TASK_TAG,
  OPERATIONAL_KPI_CHOICE,
  isOperationalTask,
  withOperationalTag,
  alignmentChoiceFor,
  alignmentChoiceError,
} = load('../utils/taskAlignment.ts');

test('the operational tag is added once, removed cleanly, and keeps other tags', () => {
  const tags = ['bucket:abc', 'completed'];
  const on = withOperationalTag(tags, true);
  assert.deepEqual(on, ['bucket:abc', 'completed', OPERATIONAL_TASK_TAG]);
  assert.deepEqual(withOperationalTag(on, true), on);
  assert.deepEqual(withOperationalTag(on, false), tags);
  assert.deepEqual(tags, ['bucket:abc', 'completed'], 'input is not mutated');
  assert.equal(isOperationalTask([' Strategy:Operational ']), true);
  assert.equal(isOperationalTask(undefined), false);
});

test('the form choice reflects a KPI link, the operational tag, or nothing', () => {
  assert.equal(alignmentChoiceFor({ kpi_id: 12, tags: [OPERATIONAL_TASK_TAG] }), '12');
  assert.equal(alignmentChoiceFor({ kpi_id: 'none', tags: [OPERATIONAL_TASK_TAG] }), OPERATIONAL_KPI_CHOICE);
  assert.equal(alignmentChoiceFor({ kpi_id: '', tags: [] }), undefined);
  assert.equal(alignmentChoiceFor(null), undefined);
});

test('new tasks must pick a KPI or operational; existing tasks are not blocked', () => {
  assert.match(alignmentChoiceError(undefined, true), /KPI/);
  assert.match(alignmentChoiceError('none', true), /KPI/);
  assert.equal(alignmentChoiceError(OPERATIONAL_KPI_CHOICE, true), null);
  assert.equal(alignmentChoiceError('42', true), null);
  assert.equal(alignmentChoiceError(undefined, false), null);
});
