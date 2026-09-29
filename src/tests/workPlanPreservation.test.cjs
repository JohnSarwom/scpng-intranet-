// Run with: node --test src/tests/workPlanPreservation.test.cjs
// Uses the installed TypeScript compiler and Node runner; no Vitest dependency.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relativePath) {
  const filename = path.resolve(__dirname, relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInThisContext(`(function(exports) { ${output}\n})`, { filename })(exports);
  return exports;
}
const editor = load('../utils/workPlanEditor.ts');
const progress = load('../utils/kpiUtils.ts');
const persisted = value => JSON.parse(JSON.stringify(value));

function fixture() {
  return [{
    id: 'divisional-goal-3', workPlanId: 'plan-27', title: 'Licensing',
    description: 'Preserve the goal narrative', linkedObjectiveId: '42', linkedObjectiveTitle: 'Existing objective',
    responsibleUnitIds: ['LIC'], responsibleUnitNames: ['Licensing'],
    progress: 37, status: 'in-progress', order: 4,
    sourceCode: 'SG3', source: { documentName: 'LIS.docx', unresolvedIssues: ['Summary mismatch'] },
    kras: [{ id: 'source-kra-3.1', code: 'SG3.1', title: 'Licensing Administration', linkedKraId: '72' }],
    goalMeasures: [{ id: 'gm1', description: 'Coverage', target: { rawText: '≥95%', operator: 'at-least', quantity: 95, unit: '%' } }],
    activities: [{
      id: 'FY27-SG3-003', goalId: 'divisional-goal-3', title: 'Assess applications', description: 'Full narrative',
      assignedUnitId: 'LIC', assignedUnitName: 'Licensing', responsiblePersonName: 'Officer', responsiblePersonEmail: 'officer@example.test',
      startDate: '2027-01-01', endDate: '2027-12-31', expectedOutput: 'Assessment reports',
      linkedTaskIds: ['task-1', 'task-2'], linkedKraId: '72', linkedKpiId: '83',
      status: 'in-progress', progress: 23, order: 6,
      source: { documentName: 'LIS.docx', table: 16, row: 4, reference: 'FY27-SG3-003' },
      sourceKraId: 'source-kra-3.1', annualTarget: { rawText: 'Continuous', serviceLevel: '≥95% within 5 working days' },
      plannedQuarters: ['Q1', 'Q2', 'Q3', 'Q4'], responsiblePosition: 'Licensing Officers', supervisorPosition: 'Manager Licensing',
      contributingUnitIds: ['LIC', 'SUP'], budget: { rawText: 'Operational' }, dependencies: 'Applicant documents', risk: 'Medium',
    }],
  }];
}

test('unchanged saves preserve IDs, all source metadata, units, execution links and progress', () => {
  const original = fixture();
  let saved = original;
  for (let i = 0; i < 3; i++) saved = editor.rowsToGoals(editor.goalsToRows(saved), 'plan-27');
  assert.deepEqual(persisted(saved), original);
  assert.equal(editor.workPlanProgressUnchanged(original, saved), true);
});

test('editing visible text preserves hidden fields and does not mutate originals', () => {
  const original = fixture();
  const rows = editor.updateWorkPlanRow(editor.goalsToRows(original), 'FY27-SG3-003', { activity: 'Revised assessment', output: 'Reviewed report' });
  const saved = editor.rowsToGoals(rows, 'plan-27');
  assert.equal(saved[0].activities[0].title, 'Revised assessment');
  assert.deepEqual(saved[0].activities[0].linkedTaskIds, ['task-1', 'task-2']);
  assert.equal(saved[0].activities[0].progress, 23);
  assert.equal(original[0].activities[0].title, 'Assess applications');
  assert.equal(editor.workPlanProgressUnchanged(original, saved), true);
});

test('goals sharing a title and objective remain distinct', () => {
  const goals = fixture();
  goals.push({ ...structuredClone(goals[0]), id: 'separate-goal', activities: [] });
  const saved = editor.rowsToGoals(editor.goalsToRows(goals), 'plan-27');
  assert.equal(saved.length, 2);
  assert.deepEqual(saved.map(goal => goal.id), ['divisional-goal-3', 'separate-goal']);
  assert.deepEqual(saved[1].activities, []);
});

test('goal rename updates its rows together without guessing another objective identity', () => {
  const goals = fixture();
  goals[0].activities.push({ ...structuredClone(goals[0].activities[0]), id: 'activity-2' });
  const rows = editor.updateWorkPlanRow(editor.goalsToRows(goals), 'FY27-SG3-003', { strategicObjective: 'Revised goal' });
  assert.ok(rows.every(row => row.strategicObjective === 'Revised goal'));
  const saved = editor.rowsToGoals(rows, 'plan-27');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].linkedObjectiveId, '42');
  assert.equal(saved[0].id, goals[0].id);
});

test('duplicates have fresh stable identities, zero progress and no source or execution IDs', () => {
  const rows = editor.goalsToRows(fixture());
  const duplicate = editor.duplicateWorkPlanRow(rows[0]);
  const saved = editor.rowsToGoals([...rows, duplicate], 'plan-27');
  const activity = saved[0].activities[1];
  assert.notEqual(activity.id, rows[0].id);
  assert.deepEqual(activity.linkedTaskIds, []);
  for (const field of ['linkedKraId', 'linkedKpiId', 'source', 'sourceKraId']) assert.equal(activity[field], undefined);
  assert.equal(activity.status, 'not-started');
  assert.equal(activity.progress, 0);
  assert.equal(editor.rowsToGoals([...rows, duplicate], 'plan-27')[0].activities[1].id, activity.id);
});

test('status changes are detected, while planned quarters never count as completion', () => {
  const goals = fixture();
  const unchanged = editor.rowsToGoals(editor.goalsToRows(goals), 'plan-27');
  assert.equal(unchanged[0].progress, 37);
  const rows = editor.updateWorkPlanRow(editor.goalsToRows(goals), 'FY27-SG3-003', { status: 'completed' });
  const saved = editor.rowsToGoals(rows, 'plan-27');
  assert.equal(saved[0].activities[0].progress, 100);
  assert.equal(editor.workPlanProgressUnchanged(goals, saved), false);
});

test('blanking an existing activity title does not silently delete its linked record', () => {
  const rows = editor.updateWorkPlanRow(editor.goalsToRows(fixture()), 'FY27-SG3-003', { activity: '' });
  assert.equal(editor.rowsToGoals(rows, 'plan-27')[0].activities[0].linkedKpiId, '83');
});

test('new rows keep stable IDs on successive conversions and saves', () => {
  const row = { ...editor.goalsToRows(fixture())[0], id: 'new-stable', originalGoal: undefined, originalActivity: undefined };
  const saved = editor.rowsToGoals([row], 'plan-27');
  assert.deepEqual(persisted(editor.rowsToGoals(editor.goalsToRows(saved), 'plan-27')), persisted(saved));
});

test('source metadata and execution IDs survive the actual SharePoint GoalsJSON mappers', () => {
  const filename = path.resolve(__dirname, '../services/sharePointOpsService.ts');
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  const service = source.statements.find(statement => ts.isClassDeclaration(statement) && statement.name.text === 'SharePointOpsService');
  const methods = service.members.filter(member => member.name && ['buildWorkPlanFields', 'mapWorkPlan'].includes(member.name.getText(source)));
  assert.equal(methods.length, 2);
  const output = ts.transpileModule(`class Mapper { ${methods.map(method => method.getText(source)).join('\n')} }; new Mapper();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mapper = vm.runInThisContext(output);
  const goals = editor.rowsToGoals(editor.goalsToRows(fixture()), 'plan-27');
  const fields = mapper.buildWorkPlanFields({ goals, overallProgress: 37 });
  const saved = mapper.mapWorkPlan({ id: 'plan-27', fields });
  assert.deepEqual(saved.goals, persisted(goals));
  assert.equal(saved.overallProgress, 37);
});

test('existing organizational progress contracts remain unchanged (including known legacy differences)', () => {
  const objectives = [{ id: '42', parentGoalId: 'org-1', progress: 50 }];
  const corporateKras = [{ id: 'corp-kra', goalId: 'org-1' }];
  const initiatives = [{ id: 'initiative', kraId: 'corp-kra', progress: 100, status: 'completed' }];
  assert.equal(progress.calculateGoalProgressFromChildren('org-1', objectives), 50);
  assert.equal(progress.calculateGoalProgressFromChildren('org-1', objectives, [], [], corporateKras, initiatives), 75);
  assert.equal(progress.calculateKpiProgress({ calculationType: 'checklist', checklist: [{ checked: true }, { checked: false }] }), 50);
  assert.equal(progress.calculateKraProgress({ id: '72' }, [{ kra_id: '72', calculationType: 'manual', actual: 50, target: 100 }]), 0);
});
