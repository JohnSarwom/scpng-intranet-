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

const { scopeRecordsToDivision } = load('../utils/divisionScope.ts');

const kras = [
  { id: 1, division: 'Corporate Services Division', unit: 'IT Unit' },
  { id: 2, division: 'Executive Division', unit: 'Secretariat Unit' },
  { id: 3, division: '', unit: 'hr unit' },
];
const kpis = [
  { id: 10, kra_id: 1 },
  { id: 11, kra_id: 2 },
  { id: 12, kra_id: 3 },
  { id: 13, kra_id: null },
];
const tasks = [
  { id: 't1', unit_id: 'IT Unit' },
  { id: 't2', unit_id: 'Secretariat Unit' },
  { id: 't3', unit_id: '', kpi_id: 10 },
  { id: 't4', unit_id: '', kpi_id: 11 },
  { id: 't5', unit_id: '' },
  { id: 't6', unit_id: '', kra_id: 3 },
];

const ids = records => records.map(r => r.id);

test('a Division keeps only its own KRAs, their KPIs and its units\' tasks', () => {
  const scoped = scopeRecordsToDivision({
    divisionName: 'Corporate Services', unitNames: ['IT Unit', 'HR Unit'], tasks, kpis, kras,
  });
  assert.deepEqual(ids(scoped.kras), [1, 3]);
  assert.deepEqual(ids(scoped.kpis), [10, 12]);
  assert.deepEqual(ids(scoped.tasks), ['t1', 't3', 't6']);
});

test('another Division no longer receives the viewer\'s own unit tasks or organisation-wide KPIs', () => {
  const scoped = scopeRecordsToDivision({
    divisionName: 'Executive Division', unitNames: ['Secretariat Unit'], tasks, kpis, kras,
  });
  assert.deepEqual(ids(scoped.kras), [2]);
  assert.deepEqual(ids(scoped.kpis), [11]);
  assert.deepEqual(ids(scoped.tasks), ['t2', 't4']);
});

test('scoping only removes records and never mutates the input', () => {
  const snapshot = JSON.stringify({ tasks, kpis, kras });
  const scoped = scopeRecordsToDivision({ divisionName: 'Legal', unitNames: [], tasks, kpis, kras });
  assert.deepEqual(scoped, { tasks: [], kpis: [], kras: [] });
  assert.equal(JSON.stringify({ tasks, kpis, kras }), snapshot);
});
