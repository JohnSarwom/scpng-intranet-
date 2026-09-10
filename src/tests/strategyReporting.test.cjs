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
  vm.runInThisContext(`(function(exports, require) { ${code}\n})`, { filename })(exports, require);
  return exports;
}

const { buildStrategyReport, strategyReportToCsv, taskIntersectsReportingWindow } =
  load('../services/strategyReportingService.ts');

const task = (id, fields = {}) => ({
  id, sourceId: id, title: `Task ${id}`, sourceList: 'Operations_Tasks', status: 'in-progress',
  dueDate: '2027-01-20T00:00:00.000Z', evidenceCount: 0,
  raw: { id, title: `Task ${id}`, description: '', status: 'in-progress', priority: 'medium', assignee: '',
    startDate: new Date('2026-12-20T00:00:00.000Z'), dueDate: '2027-01-20T00:00:00.000Z', ...fields.raw },
  ...fields,
});

function graphFixture() {
  const overlapping = task('overlap');
  const completionEvent = task('event', {
    status: 'completed', completedAt: '2027-01-12T00:00:00.000Z', evidenceCount: 2,
    raw: { startDate: new Date('2026-01-01T00:00:00.000Z'), dueDate: '2026-02-01T00:00:00.000Z', completionPercentage: 100 },
  });
  const noEvidence = task('missing', {
    title: 'Completed, no evidence', status: 'completed', completedAt: '2027-01-14T00:00:00.000Z',
    raw: { startDate: new Date('2027-01-10T00:00:00.000Z'), dueDate: '2027-01-14T00:00:00.000Z', completionPercentage: 100 },
  });
  const undated = task('undated', { dueDate: undefined, raw: { startDate: undefined, dueDate: '', createdAt: '2027-01-10T00:00:00.000Z' } });
  const leaf = {
    id: 'kpi:1', sourceId: '1', title: 'Applications processed', sourceList: 'Performance_KPIs',
    ownerRole: 'officer', ownerName: 'Officer One', division: 'Licensing', unit: 'Licensing Unit',
    progress: { value: 75, statusBand: 'on_track', hasLinkedData: true, source: 'specialized-measurement',
      scope: 'division', calculatedAt: '2027-01-15T00:00:00.000Z', childCount: 3, explanation: 'Evidence-based',
      measurement: { mode: 'count', rawTarget: 'At least 10', operator: 'at-least', target: 10, actual: 9, evidenceCount: 2, state: 'calculated' } },
    measurementDefinition: { mode: 'count', rawTarget: 'At least 10', operator: 'at-least', target: 10 },
    measurementEvidence: { windowStart: '2027-01-01', windowEnd: '2027-01-31', actual: 9, evidenceRefs: ['register.csv'] },
    dataSource: 'Licensing register', reportingFrequency: 'monthly', reviewAuthority: 'Director', reviewStatus: 'approved',
    children: [], tasks: [overlapping, completionEvent, noEvidence, undated],
  };
  const goal = { id: 'goal:1', sourceId: '1', title: 'Market confidence', sourceList: 'Strategic_Goals', performanceRoots: [leaf] };
  return {
    generatedAt: '2027-01-15T00:00:00.000Z', scope: 'division', goals: [goal], divisions: [], diagnostics: [],
    exceptions: { performanceRecords: [], tasks: [] },
    lookups: {
      goalsById: { 'goal:1': goal }, performanceRecordsById: { 'kpi:1': leaf },
      tasksById: { overlap: overlapping, event: completionEvent, missing: noEvidence, undated },
      divisionsById: { licensing: { id: 'licensing' } }, unitsById: { unit: { id: 'unit' } },
    },
    integrity: {
      inputGoalCount: 1, inputPerformanceRecordCount: 1, inputTaskCount: 4,
      includedPerformanceRecordCount: 1, includedTaskCount: 4,
      representedGoalCount: 1, representedPerformanceRecordCount: 1, representedTaskCount: 4,
      filteredOutPerformanceRecordCount: 0, filteredOutTaskCount: 0,
      performanceRecordsConserved: true, tasksConserved: true, isConserved: true,
    },
  };
}

test('report snapshot uses interval overlap and actual completion events, never createdAt alone', () => {
  const graph = graphFixture();
  const report = buildStrategyReport(graph, {
    type: 'strategic-traceability', title: 'January traceability', generatedBy: 'Director',
    scopeLabel: 'Licensing', dateRange: { start: '2027-01-01', end: '2027-01-31T23:59:59Z' },
    generatedAt: '2027-02-01T00:00:00.000Z',
  });
  const rows = report.sections.find(section => section.id === 'traceability').rows;
  const taskIds = rows.filter(row => row.entityType === 'task').map(row => row.entityId);
  assert.deepEqual(taskIds, ['overlap', 'event', 'missing']);
  assert.equal(report.summary.taskCount, 3);
  assert.equal(report.summary.evidenceCount, 4);
  assert.equal(report.sections.find(section => section.id === 'evidence-warnings').rows.length, 1);
  assert.equal(report.snapshot.dateBasis, 'task-interval-overlap-and-completion-events');
  assert.equal(report.sections.find(section => section.id === 'division-unit-heatmap').rows.length, 1);
  assert.equal(report.sections.find(section => section.id === 'progress-variance').rows[0].variance, -1);
  assert.equal(report.sections.find(section => section.id === 'kpi-review-governance').rows[0].nextAction, undefined);
  assert.equal(Object.isFrozen(report), true);
  graph.goals[0].title = 'Changed live title';
  assert.equal(report.goals[0].title, 'Market confidence');
});

test('CSV exports the frozen hierarchy rows and safely quotes values', () => {
  const graph = graphFixture();
  graph.goals[0].performanceRoots[0].title = 'Applications, processed';
  const report = buildStrategyReport(graph, {
    type: 'strategic-traceability', title: 'January', generatedBy: 'Director', scopeLabel: 'Licensing',
    dateRange: { start: '2027-01-01', end: '2027-01-31' }, generatedAt: '2027-02-01',
  });
  const csv = strategyReportToCsv(report);
  assert.match(csv, /"Parent path"/);
  assert.match(csv, /"KPI measurement variance"/);
  assert.match(csv, /"Applications, processed"/);
  assert.match(csv, /"Market confidence > Applications, processed"/);
  assert.equal(csv.split('\n').length, report.sections.reduce((sum, section) => sum + section.rows.length, 1));
});

test('specialized governance sections expose unlinked records and fail-closed KPI review gaps', () => {
  const graph = graphFixture();
  const leaf = graph.goals[0].performanceRoots[0];
  leaf.dataSource = undefined;
  leaf.reviewStatus = 'draft';
  leaf.progress.measurement.actual = undefined;
  graph.diagnostics.push({
    id: 'unlinked-task:missing-parent', entityType: 'task', entityId: 'orphan', severity: 'error',
    message: 'Task has no parent.', missingRelationship: 'KPI or KRA', recommendedAction: 'Link the Task.',
  });
  const report = buildStrategyReport(graph, {
    type: 'kpi-review-governance', title: 'Governance', generatedBy: 'Director', scopeLabel: 'Licensing',
    dateRange: { start: '2027-01-01', end: '2027-01-31' }, generatedAt: '2027-02-01',
  });
  assert.equal(report.sections.find(section => section.id === 'unlinked-records').rows.length, 1);
  const variance = report.sections.find(section => section.id === 'progress-variance').rows[0];
  assert.equal(variance.varianceState, 'unavailable');
  assert.match(variance.nextAction, /normalized target and dated actual/);
  const review = report.sections.find(section => section.id === 'kpi-review-governance').rows[0];
  assert.match(review.nextAction, /data source/);
  assert.match(review.nextAction, /approved review/);
});

test('report generation fails closed for invalid range, missing scope identity, or unconserved graph', () => {
  const graph = graphFixture();
  const base = { type: 'strategic-traceability', title: 'Report', generatedBy: 'Director' };
  assert.throws(() => buildStrategyReport(graph, { ...base, dateRange: { start: 'bad', end: '2027-01-31' }, scopeLabel: 'Licensing' }), /valid report date range/);
  assert.throws(() => buildStrategyReport(graph, { ...base, dateRange: { start: '2027-01-01', end: '2027-01-31' }, scopeLabel: 'Licensing', generatedAt: 'bad' }), /valid report generation time/);
  assert.throws(() => buildStrategyReport(graph, { ...base, dateRange: { start: '2027-01-01', end: '2027-01-31' } }), /explicit scope label/);
  graph.integrity.isConserved = false;
  assert.throws(() => buildStrategyReport(graph, { ...base, dateRange: { start: '2027-01-01', end: '2027-01-31' }, scopeLabel: 'Licensing' }), /failed conservation/);
});

test('date-only report end includes events throughout the final day', () => {
  const graph = graphFixture();
  graph.lookups.tasksById.event.completedAt = '2027-01-31T22:45:00.000Z';
  const report = buildStrategyReport(graph, {
    type: 'strategic-traceability', title: 'January', generatedBy: 'Director', scopeLabel: 'Licensing',
    dateRange: { start: '2027-01-01', end: '2027-01-31' }, generatedAt: '2027-02-01T00:00:00.000Z',
  });
  const taskIds = report.sections.find(section => section.id === 'traceability').rows
    .filter(row => row.entityType === 'task').map(row => row.entityId);
  assert.equal(taskIds.includes('event'), true);
  assert.equal(report.dateRange.end, '2027-01-31T23:59:59.999Z');
});

test('task interval helper accepts overlap and completion but rejects created-only records', () => {
  const start = Date.parse('2027-01-01'), end = Date.parse('2027-01-31');
  assert.equal(taskIntersectsReportingWindow(task('one'), start, end), true);
  assert.equal(taskIntersectsReportingWindow(task('two', { dueDate: undefined, completedAt: '2027-01-05', raw: { startDate: undefined, dueDate: '' } }), start, end), true);
  assert.equal(taskIntersectsReportingWindow(task('three', { dueDate: undefined, raw: { startDate: undefined, dueDate: '', createdAt: '2027-01-05' } }), start, end), false);
});
