const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const servicePath = path.resolve(__dirname, '../services/strategyExecutionGraphService.ts');
const source = fs.readFileSync(servicePath, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: servicePath,
}).outputText;

const normalizeLookupString = value => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return !normalized || ['none', 'null', 'undefined', 'nan'].includes(normalized.toLowerCase())
    ? null
    : normalized;
};

const serviceModule = { exports: {} };
const localRequire = request => {
  if (request === '@/utils/sharePointLookupUtils') return { normalizeLookupString };
  throw new Error(`Unexpected runtime import in graph service: ${request}`);
};
vm.runInThisContext(
  `(function(require, module, exports) { ${output}\n})`,
  { filename: servicePath },
)(localRequire, serviceModule, serviceModule.exports);

const { buildStrategyExecutionGraph, UNLINKED_GOAL_ID } = serviceModule.exports;

const goal = (id, title = `Goal ${id}`) => ({ id, title });
const record = (id, extra = {}) => ({ id, title: `Record ${id}`, ...extra });
const task = (id, extra = {}) => ({
  id,
  title: `Task ${id}`,
  description: '',
  status: 'todo',
  priority: 'medium',
  assignee: 'Officer',
  dueDate: '2026-09-08',
  ...extra,
});

test('unlinked Tasks are conserved in lookups and the exception collection', () => {
  const graph = buildStrategyExecutionGraph({
    strategicGoals: [goal('g1')],
    performanceRecords: [],
    tasks: [task('t1', { kpi_id: 'missing' })],
  });

  assert.equal(graph.lookups.tasksById.t1.id, 't1');
  assert.deepEqual(graph.exceptions.tasks.map(item => item.id), ['t1']);
  assert.ok(graph.diagnostics.some(item => item.id === 'task-without-performance-parent:t1'));
  assert.equal(graph.integrity.tasksConserved, true);
});

test('parent cycles are diagnosed, broken safely, and retain every record', () => {
  const graph = buildStrategyExecutionGraph({
    performanceRecords: [
      record('a', { parentId: 'b', ownerRole: 'manager' }),
      record('b', { parentId: 'a', ownerRole: 'manager' }),
    ],
  });

  assert.equal(Object.keys(graph.lookups.performanceRecordsById).length, 2);
  assert.equal(graph.integrity.performanceRecordsConserved, true);
  assert.equal(graph.diagnostics.filter(item => item.id.startsWith('parent-cycle:')).length, 2);
  assert.equal(graph.goals.find(item => item.id === UNLINKED_GOAL_ID).performanceRoots.length, 1);
});

test('duplicate performance IDs cannot overwrite each other or attract an ambiguous Task', () => {
  const graph = buildStrategyExecutionGraph({
    performanceRecords: [record('same'), record('same')],
    tasks: [task('t1', { kpi_id: 'same' })],
  });

  assert.equal(Object.keys(graph.lookups.performanceRecordsById).length, 2);
  assert.equal(graph.exceptions.performanceRecords.length, 2);
  assert.equal(graph.exceptions.tasks.length, 1);
  assert.ok(graph.diagnostics.some(item => item.id.startsWith('ambiguous-task-link:t1')));
  assert.equal(graph.integrity.isConserved, true);
});

test('duplicate Task IDs receive distinct graph identities instead of overwriting', () => {
  const graph = buildStrategyExecutionGraph({
    performanceRecords: [record('p1')],
    tasks: [task('same', { kpi_id: 'p1' }), task('same', { kpi_id: 'p1' })],
  });

  assert.equal(Object.keys(graph.lookups.tasksById).length, 2);
  assert.equal(graph.lookups.performanceRecordsById.p1.tasks.length, 2);
  assert.equal(graph.diagnostics.filter(item => item.id.startsWith('duplicate-task-id:')).length, 2);
  assert.equal(graph.integrity.tasksConserved, true);
});

test('dual KPI and KRA Task links attach once and remain visible as a diagnostic', () => {
  const graph = buildStrategyExecutionGraph({
    performanceRecords: [record('kpi:1'), record('kra:2')],
    tasks: [task('t1', { kpi_id: '1', kra_id: '2' })],
  });

  assert.equal(graph.lookups.performanceRecordsById['kpi:1'].tasks.length, 1);
  assert.equal(graph.lookups.performanceRecordsById['kra:2'].tasks.length, 0);
  assert.ok(graph.diagnostics.some(item => item.id === 'duplicate-task-links:t1'));
  assert.equal(graph.integrity.tasksConserved, true);
});

test('unit scope keeps matching ancestry and excludes unrelated records', () => {
  const graph = buildStrategyExecutionGraph({
    scope: 'unit',
    scopeContext: { division: 'Legal', unit: 'Licensing' },
    strategicGoals: [goal('g1')],
    performanceRecords: [
      record('parent', { parentStrategicGoalId: 'g1', ownerRole: 'director', division: 'Legal' }),
      record('in', { parentId: 'parent', ownerRole: 'manager', unit: 'Licensing' }),
      record('out', { parentId: 'parent', ownerRole: 'manager', unit: 'Enforcement' }),
    ],
  });

  assert.deepEqual(Object.keys(graph.lookups.performanceRecordsById).sort(), ['in', 'parent']);
  assert.equal(graph.lookups.performanceRecordsById.parent.inScope, false);
  assert.equal(graph.lookups.performanceRecordsById.in.inScope, true);
  assert.equal(graph.integrity.filteredOutPerformanceRecordCount, 1);
});

test('scoped graphs fail closed when their context is missing', () => {
  const graph = buildStrategyExecutionGraph({
    scope: 'personal',
    performanceRecords: [record('private', { ownerEmail: 'person@example.com' })],
  });

  assert.equal(Object.keys(graph.lookups.performanceRecordsById).length, 0);
  assert.ok(graph.diagnostics.some(item => item.id === 'scope-context-missing:personal'));
  assert.equal(graph.integrity.filteredOutPerformanceRecordCount, 1);
});

test('checklist evidence is calculated and direct parent evidence is preserved without formula replacement', () => {
  const graph = buildStrategyExecutionGraph({
    strategicGoals: [goal('g1')],
    performanceRecords: [
      record('parent', {
        parentStrategicGoalId: 'g1',
        ownerRole: 'manager',
        checklist: [{ id: 'direct', text: 'Direct', checked: true }],
      }),
      record('leaf', {
        parentId: 'parent',
        ownerRole: 'officer',
        calculationType: 'checklist',
        checklist: [
          { id: 'one', text: 'One', checked: true },
          { id: 'two', text: 'Two', checked: false },
        ],
      }),
    ],
    tasks: [task('direct-task', { kpi_id: 'parent', status: 'completed', completed: true })],
  });

  assert.equal(graph.lookups.performanceRecordsById.leaf.progress.value, 50);
  assert.equal(graph.lookups.performanceRecordsById.parent.evidenceCount, 2);
  assert.ok(graph.diagnostics.some(item => item.id === 'direct-evidence-on-parent:parent'));
  assert.equal(graph.lookups.performanceRecordsById.parent.progress.value, 50);
});
