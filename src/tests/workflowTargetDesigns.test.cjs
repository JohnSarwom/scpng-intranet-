// Run with: node --test src/tests/workflowTargetDesigns.test.cjs
// Structure charts and the target designs added to Workflow Studio on 12 November 2026.
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

const schema = load('../workflows/workflowSchema.ts');
const run = load('../workflows/workflowRun.ts');
const { TASK_REGISTRY_TO_STRATEGIC_GOAL } = load('../workflows/definitions/taskRegistryToStrategicGoal.ts');
const { TASK_ASSIGNMENT_REVIEW: taskFlow } = load('../workflows/definitions/taskAssignmentReview.ts');
const { REPORTING_HIERARCHY: reporting } = load('../workflows/definitions/reportingHierarchy.ts');
const { ORGANISATIONAL_STRUCTURE: structure } = load('../workflows/definitions/organisationalStructure.ts');
const repoRoot = path.resolve(__dirname, '..', '..');
const builtIns = [TASK_REGISTRY_TO_STRATEGIC_GOAL, taskFlow, reporting, structure];

const chain = (definition, id) => schema.reportingChain(definition, id).map(node => node.id);

test('every built-in workflow is valid after layout, with unique IDs', () => {
  for (const definition of builtIns) {
    assert.deepEqual(schema.validateWorkflow(schema.autoLayout(definition)), [], definition.id);
  }
  assert.equal(new Set(builtIns.map(definition => definition.id)).size, builtIns.length);
});

test('every source file a built-in workflow cites exists', () => {
  for (const definition of builtIns) {
    for (const file of new Set(definition.nodes.flatMap(node => node.details?.code || []))) {
      assert.ok(fs.existsSync(path.join(repoRoot, file)), `${file} is cited by "${definition.id}" but does not exist`);
    }
  }
});

test('target designs say, for every step or box, how much the app does today', () => {
  for (const definition of [taskFlow, reporting, structure]) {
    assert.equal(definition.status, 'target');
    for (const node of definition.nodes) {
      if (node.rank === 'group') continue;
      assert.ok(['built', 'partial', 'missing'].includes(node.appStatus), `${definition.id}/${node.id} has no appStatus`);
      assert.ok(node.details?.today, `${definition.id}/${node.id} has no "today" note`);
    }
  }
});

test('reporting lines follow the agreed hierarchy', () => {
  assert.deepEqual(chain(reporting, 'finance-officer'),
    ['board', 'ceo', 'directors', 'csd-director', 'finance-manager', 'finance-senior', 'finance-officer']);
  assert.deepEqual(chain(reporting, 'executive-officer'), ['board', 'ceo', 'general-counsel', 'executive-officer']);
  assert.deepEqual(chain(reporting, 'audit-officer'), ['board', 'ceo', 'audit-manager', 'audit-senior', 'audit-officer']);
  assert.deepEqual(chain(reporting, 'secretariat'), ['board', 'ceo', 'secretariat']);
  for (const director of ['csd-director', 'lsd-director', 'lisd-director', 'rpd-director']) {
    assert.ok(!chain(reporting, director).includes('general-counsel'), `${director} must not report through the General Counsel`);
  }
  // Every manager has a Senior Officer and an Officer beneath.
  const managers = reporting.nodes.filter(node => node.rank === 'manager');
  assert.equal(managers.length, 13);
  for (const manager of managers) {
    const [senior] = schema.hierarchyChildren(reporting, manager.id);
    assert.equal(senior?.rank, 'senior', manager.id);
    assert.equal(schema.hierarchyChildren(reporting, senior.id)[0]?.rank, 'officer', manager.id);
  }
});

test('the structure chart has the four divisions and their units under the CEO', () => {
  assert.deepEqual(schema.hierarchyChildren(structure, 'ceo').map(node => node.id), ['secretariat', 'general-counsel', 'internal-audit', 'divisions']);
  assert.deepEqual(schema.hierarchyChildren(structure, 'divisions').map(node => node.id), ['csd', 'lsd', 'lisd', 'rpd']);
  const units = structure.nodes.filter(node => node.rank === 'unit');
  assert.equal(units.length, 12);
  assert.ok(units.every(node => chain(structure, node.id)[1] === 'ceo'));
});

test('chart layout is top-down with each box centred over the boxes beneath it', () => {
  const layout = schema.layoutHierarchy(structure);
  const at = id => layout.nodes.find(node => node.id === id);
  assert.equal(layout.nodes.length, structure.nodes.length);
  assert.ok(at('board').y < at('ceo').y && at('ceo').y < at('csd').y && at('csd').y < at('finance').y);
  assert.equal(at('csd').x, (at('finance').x + at('it').x) / 2);
  const xs = layout.nodes.filter(node => node.y === at('finance').y).map(node => node.x);
  assert.equal(new Set(xs).size, xs.length, 'boxes on one row do not overlap');
});

test('closing a branch hides everything beneath it but keeps the box and its count', () => {
  const layout = schema.layoutHierarchy(reporting, new Set(['csd-director', 'audit-manager']));
  const ids = new Set(layout.nodes.map(node => node.id));
  assert.ok(ids.has('csd-director') && ids.has('audit-manager'));
  for (const hidden of ['finance-manager', 'finance-officer', 'audit-senior', 'audit-officer']) assert.ok(!ids.has(hidden), hidden);
  assert.ok(ids.has('lsd-director') && ids.has('legal-advisory-officer'));
  assert.equal(layout.childCounts['csd-director'], 3);
  assert.ok(layout.edges.every(edge => ids.has(edge.from) && ids.has(edge.to)));
});

const chartFixture = () => ({
  schemaVersion: 1, id: 'small-chart', title: 'Small chart', status: 'draft', source: 'manual', kind: 'hierarchy',
  nodes: [
    { id: 'ceo', label: 'CEO', type: 'org', rank: 'executive' },
    { id: 'director', label: 'Director', type: 'org', rank: 'director' },
    { id: 'manager', label: 'Manager', type: 'org', rank: 'manager' },
  ],
  edges: [{ from: 'ceo', to: 'director' }, { from: 'director', to: 'manager' }],
});

test('structure-chart problems are reported in plain words', () => {
  assert.deepEqual(schema.validateWorkflow(chartFixture()), []);

  const twoParents = chartFixture();
  twoParents.edges.push({ from: 'ceo', to: 'manager' });
  assert.match(schema.validateWorkflow(twoParents).join(' '), /"Manager" reports to more than one box/);

  const twoTops = chartFixture();
  twoTops.nodes.push({ id: 'board', label: 'Board', type: 'org', rank: 'board' });
  assert.match(schema.validateWorkflow(twoTops).join(' '), /exactly one top box; found 2/);

  const noRank = chartFixture();
  delete noRank.nodes[2].rank;
  assert.match(schema.validateWorkflow(noRank).join(' '), /needs a rank/);

  const withFields = chartFixture();
  withFields.nodes[1].fields = [{ key: 'name', label: 'Name', kind: 'text' }];
  assert.match(schema.validateWorkflow(withFields).join(' '), /no fields or decisions/);

  const loopBack = chartFixture();
  loopBack.edges.push({ from: 'manager', to: 'ceo', kind: 'feedback' });
  assert.match(schema.validateWorkflow(loopBack).join(' '), /must be "flow" \(reports to\) or "reads"/);

  const processBox = chartFixture();
  delete processBox.kind;
  assert.match(schema.validateWorkflow(processBox).join(' '), /has type "org"/);

  const big = chartFixture();
  for (let i = 0; i < 80; i += 1) {
    big.nodes.push({ id: `officer${i}`, label: `Officer ${i}`, type: 'org', rank: 'officer' });
    big.edges.push({ from: 'manager', to: `officer${i}` });
  }
  assert.match(schema.validateWorkflow(big).join(' '), /At most 80 boxes/);
});

test('normalising and AI parsing keep chart and app-status fields', () => {
  const raw = chartFixture();
  raw.nodes[1].appStatus = 'partial';
  raw.nodes[1].details = { today: 'Director Review is a leave stage.' };
  const normalised = schema.normaliseWorkflow(raw);
  assert.equal(normalised.kind, 'hierarchy');
  assert.equal(normalised.nodes[1].rank, 'director');
  assert.equal(normalised.nodes[1].appStatus, 'partial');
  assert.equal(normalised.nodes[1].details.today, 'Director Review is a leave stage.');
  assert.ok(normalised.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)));

  const parsed = schema.parseAiWorkflow(`Here is the chart.<workflow>${JSON.stringify(chartFixture())}</workflow>`);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.definition.kind, 'hierarchy');
});

test('app-status totals leave out layout-only groups', () => {
  assert.deepEqual(schema.appStatusCounts(structure), { built: 2, partial: 15, missing: 4 });
  assert.equal(schema.appStatusCounts(TASK_REGISTRY_TO_STRATEGIC_GOAL), null);
});

// --- Simulating the task assignment design ------------------------------------

/** Completes active steps until the run finishes or a step has no prepared answer. */
function drive(state, answers) {
  let guard = 0;
  while (!state.finished && state.active.length && guard++ < 60) {
    const id = state.active[0];
    const node = taskFlow.nodes.find(item => item.id === id);
    const queue = answers[id];
    const automatic = run.derivedChoice(taskFlow, id, state.values);
    const values = Array.isArray(queue) ? queue.shift() : queue
      || automatic || (node.type === 'input' || node.type === 'gate' ? null : {});
    if (!values) break;
    state = run.advanceRun(taskFlow, state, id, values).state;
  }
  return state;
}

const baseAnswers = type => ({
  create: { title: 'Review licence', dueDate: '2026-12-15', priority: 'Medium' },
  classify: { type },
  kpi: { kpi: 'Licences processed within 5 days' },
  assign: { assignee: 'Officer', assignedBy: 'Manager' },
  accept: { decision: 'Accept' },
  work: { progress: 'Done' },
  review: { decision: 'Verified' },
  manager: { decision: 'Approve' },
});

test('a KPI-linked task is reviewed, approved, measured against its KPI and reported up', () => {
  const state = drive(run.startRun(taskFlow), baseAnswers('KPI-linked task'));
  assert.ok(state.finished);
  for (const id of ['kpi', 'accept', 'review', 'manager', 'verified', 'kpi-result', 'rollup', 'ceo-dashboard', 'board']) {
    assert.ok(state.completed.includes(id), id);
  }
  assert.ok(!state.completed.includes('operational-result'));
  assert.ok(!state.completed.includes('escalation'), 'escalation is only for escalated tasks');
});

test('an operational task skips the KPI and is tracked as operational work', () => {
  const state = drive(run.startRun(taskFlow), baseAnswers('Operational task'));
  assert.ok(state.finished);
  assert.ok(!state.completed.includes('kpi'));
  assert.ok(state.completed.includes('operational-result'));
  assert.ok(!state.completed.includes('kpi-result'));
});

test('returns go back to the work, escalations go through the Director or CEO', () => {
  const answers = baseAnswers('KPI-linked task');
  answers.manager = [{ decision: 'Return for changes' }, { decision: 'Escalate' }];
  answers.work = [{ progress: 'First draft' }, { progress: 'Revised' }];
  answers.escalation = { decision: 'Approve' };
  let state = drive(run.startRun(taskFlow), answers);
  assert.ok(state.finished);
  assert.ok(state.history.some(event => event.kind === 'returned' && event.nodeId === 'work'));
  assert.ok(state.completed.includes('escalation'));
  assert.equal(state.values.work.progress, 'Revised');

  const queried = baseAnswers('Operational task');
  queried.accept = [{ decision: 'Query or decline' }, { decision: 'Accept' }];
  state = drive(run.startRun(taskFlow), queried);
  assert.ok(state.finished);
  assert.ok(state.history.some(event => event.kind === 'returned' && event.nodeId === 'assign'));
});
