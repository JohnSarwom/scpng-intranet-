// Run with: node --test src/tests/workflowRun.test.cjs
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

const run = load('../workflows/workflowRun.ts');
const { TASK_REGISTRY_TO_STRATEGIC_GOAL: taskWorkflow } = load('../workflows/definitions/taskRegistryToStrategicGoal.ts');

/** Completes active steps in order until the run finishes or needs input. */
function drive(definition, state, inputs) {
  let guard = 0;
  while (!state.finished && state.active.length && guard++ < 50) {
    const id = state.active[0];
    const node = definition.nodes.find(item => item.id === id);
    const values = inputs[id] || run.derivedChoice(definition, id, state.values) || (node.type === 'input' || node.type === 'gate' ? null : {});
    if (values === null) break;
    state = run.advanceRun(definition, state, id, values).state;
  }
  return state;
}

// V9's shape: a decision fans out to two KRAs that merge again.
const branching = mode => ({
  schemaVersion: 1, id: 'branching', title: 'Branching', status: 'draft', source: 'manual',
  nodes: [
    { id: 'task', label: 'Task', type: 'input' },
    { id: 'gate', label: 'Route', type: 'gate', gate: { mode, choiceField: 'route' }, fields: [{ key: 'route', label: 'Route', kind: 'select', options: ['A', 'B'] }] },
    { id: 'kraA', label: 'KRA A', type: 'input' },
    { id: 'kraB', label: 'KRA B', type: 'input' },
    { id: 'join', label: 'Merge', type: 'auto' },
    { id: 'review', label: 'Review', type: 'gate', gate: { mode: 'or', choiceField: 'decision' }, fields: [{ key: 'decision', label: 'Decision', kind: 'select', options: ['Approve', 'Return for revision'] }] },
    { id: 'finish', label: 'Finish', type: 'end' },
  ],
  edges: [
    { from: 'task', to: 'gate' },
    { from: 'gate', to: 'kraA', when: 'A' },
    { from: 'gate', to: 'kraB', when: 'B' },
    { from: 'kraA', to: 'join' },
    { from: 'kraB', to: 'join' },
    { from: 'join', to: 'review' },
    { from: 'review', to: 'finish', when: 'Approve' },
    { from: 'review', to: 'task', when: 'Return for revision', kind: 'feedback' },
  ],
});

test('OR takes only the chosen route, and the merge does not wait for the other', () => {
  const definition = branching('or');
  let state = run.startRun(definition);
  state = run.advanceRun(definition, state, 'task', {}).state;
  const result = run.advanceRun(definition, state, 'gate', { route: 'B' });
  assert.deepEqual(result.transfers.map(t => t.to), ['kraB']);
  state = run.advanceRun(definition, result.state, 'kraB', {}).state;
  assert.deepEqual(state.active, ['join'], 'only the started branch is awaited');
});

test('AND takes every route and the merge waits for both', () => {
  const definition = branching('and');
  let state = run.startRun(definition);
  state = run.advanceRun(definition, state, 'task', {}).state;
  state = run.advanceRun(definition, state, 'gate', {}).state;
  assert.deepEqual(state.active, ['kraA', 'kraB']);
  state = run.advanceRun(definition, state, 'kraA', {}).state;
  assert.deepEqual(state.waiting, ['join']);
  assert.ok(!state.active.includes('join'));
  state = run.advanceRun(definition, state, 'kraB', {}).state;
  assert.deepEqual(state.active, ['join']);
});

test('AND/OR takes each chosen route', () => {
  const definition = branching('andor');
  let state = run.startRun(definition);
  state = run.advanceRun(definition, state, 'task', {}).state;
  assert.deepEqual(run.advanceRun(definition, state, 'gate', { route: 'A, B' }).state.active, ['kraA', 'kraB']);
  assert.deepEqual(run.advanceRun(definition, state, 'gate', { route: 'A' }).state.active, ['kraA']);
});

test('a feedback route returns to the earlier step and clears what came after it', () => {
  const definition = branching('or');
  let state = run.startRun(definition);
  state = run.advanceRun(definition, state, 'task', { title: 'Draft' }).state;
  state = run.advanceRun(definition, state, 'gate', { route: 'A' }).state;
  state = run.advanceRun(definition, state, 'kraA', { kra: 'Efficiency' }).state;
  state = run.advanceRun(definition, state, 'join', {}).state;
  const returned = run.advanceRun(definition, state, 'review', { decision: 'Return for revision' });
  assert.deepEqual(returned.transfers, [{ from: 'review', to: 'task', kind: 'feedback' }]);
  assert.deepEqual(returned.state.active, ['task']);
  assert.deepEqual(returned.state.completed, []);
  assert.deepEqual(returned.state.values, { task: { title: 'Draft' } }, 'the returned-to step keeps its values for editing');
  assert.equal(returned.state.history.at(-1).kind, 'returned');
});

test('required values are enforced before a step completes', () => {
  const definition = branching('or');
  let state = run.startRun(definition);
  state = run.advanceRun(definition, state, 'task', {}).state;
  assert.throws(() => run.advanceRun(definition, state, 'gate', {}), /Required: Route/);
  assert.throws(() => run.advanceRun(definition, state, 'kraA', {}), /not an active step/);
});

test('the Task Registry workflow runs from task to goal through the KPI branch', () => {
  let state = run.startRun(taskWorkflow);
  state = drive(taskWorkflow, state, {
    task: run.exampleValues(taskWorkflow, 'task'),
    alignment: { choice: 'Link to a KPI' },
    kpi: { kpi: 'Licences within 5 days', calculationType: 'checklist' },
  });
  assert.equal(state.finished, true);
  assert.deepEqual(state.completed, [
    'task', 'alignment', 'kpi', 'kra', 'save', 'reconcile', 'kpiChecklist', 'kraRollup', 'objective', 'goal', 'shows',
  ]);
  assert.ok(state.history.some(event => event.detail === 'KRA taken from KPI "Licences within 5 days".'));
  assert.ok(!state.completed.includes('kpiManual'), 'the automatic decision followed the KPI\'s calculation type');
});

test('the operational branch ends the Task Registry run without touching the KPI chain', () => {
  let state = run.startRun(taskWorkflow);
  state = drive(taskWorkflow, state, {
    task: { title: 'Fix printer', status: 'To do' },
    alignment: { choice: 'Operational work' },
  });
  assert.equal(state.finished, true);
  assert.deepEqual(state.completed, ['task', 'alignment', 'operational']);
});

test('outcome templates fill in submitted values and leave unknown placeholders', () => {
  assert.equal(run.renderOutcome('KRA from {kpi.kpi} ({kpi.missing})', { kpi: { kpi: 'Turnaround' } }), 'KRA from Turnaround ({kpi.missing})');
});
