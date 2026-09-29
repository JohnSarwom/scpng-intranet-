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
  canViewWorkPlanGovernance,
  assertCanViewWorkPlanGovernance,
  buildWorkPlanGovernanceHistory,
} = load('../services/workPlanGovernanceService.ts');

const manager = { email: 'manager@example.test', name: 'Manager', role: 'manager', division: 'Licensing', isAdmin: false };

function activityImpact() {
  return {
    version: 1, operationId: 'activity-op', signature: 'sig', planId: '7', planRevision: 'v1',
    activityId: 'activity-1', activityTitle: 'Review applications', action: 'reassign',
    revisions: { sourceKra: 'k1', targetKra: 'k2', kpi: 'p1', tasks: { t1: 't1' } },
    sourceKra: { id: '10', title: 'Old KRA', progress: 40, projectedProgress: 20, activeKpiCount: 2 },
    targetKra: { id: '11', title: 'New KRA', progress: 50, projectedProgress: 60, activeKpiCount: 3 },
    kpi: { id: '20', title: 'Application KPI', status: 'In Progress', measurementEvidenceCount: 2, hasMeasurementDefinition: true, hasChecklistEvidence: false },
    tasks: [{ id: '30', title: 'Check file', status: 'In Progress' }], warnings: ['Task evidence remains attached.'],
  };
}

function structureImpact() {
  return {
    version: 1, entityKind: 'goal', operationId: 'goal-op', signature: 'sig2', planId: '7', planRevision: 'v2',
    sourceId: 'goal-1', sourceExecutionId: '100', sourceTitle: 'Market supervision', action: 'clear-links',
    affected: { objectiveIds: ['100'], kraIds: ['10'], kpiIds: ['20'], taskIds: ['30', '31'] },
    progress: [{ kind: 'objective', id: '100', title: 'Market supervision', progress: 75, projectedProgress: 0, activeMemberCount: 1, projectedMemberCount: 0 }],
    evidence: { measurementDefinitions: 1, measurementEvidenceRefs: 3, checklists: 1, tasks: 2 },
    revisions: { objectives: { 100: 'o1' }, kras: { 10: 'k1' }, kpis: { 20: 'p1' }, tasks: { 30: 't1', 31: 't2' } },
    warnings: ['Links will be cleared.'],
  };
}

function item(retirement) {
  return {
    id: '7', lastModifiedDateTime: '2027-02-02T02:00:00.000Z',
    fields: {
      Title: 'Licensing Plan', Year: 2027, DivisionId: 'lic', DivisionName: 'Licensing',
      RetirementJSON: JSON.stringify(retirement),
    },
  };
}

test('governance read access is exact for managers/directors and global only for administrators', () => {
  assert.equal(canViewWorkPlanGovernance(manager, ' licensing '), true);
  assert.equal(canViewWorkPlanGovernance({ ...manager, role: 'director' }, 'Licensing'), true);
  assert.equal(canViewWorkPlanGovernance({ ...manager, division: 'Corporate Services' }, 'Licensing'), false);
  assert.equal(canViewWorkPlanGovernance({ ...manager, role: 'staff' }, 'Licensing'), false);
  assert.equal(canViewWorkPlanGovernance({ ...manager, role: 'admin', isAdmin: true, division: '' }, 'Licensing'), true);
  assert.throws(() => assertCanViewWorkPlanGovernance(null, 'Licensing'), /permission/);
});

test('history projects completed activity and structure records with conserved impacts and actors', () => {
  const activity = activityImpact();
  const structure = structureImpact();
  const history = buildWorkPlanGovernanceHistory([item({
    version: 1,
    history: [
      {
        operationId: activity.operationId, activityId: activity.activityId, action: activity.action,
        reason: 'Approved in minute one', completedAt: '2027-02-01T01:00:00.000Z',
        sourceKraId: activity.sourceKra.id, targetKraId: activity.targetKra.id, kpiId: activity.kpi.id,
        taskIds: ['30'], impact: activity, activitySnapshot: { title: 'Review applications' },
        performedBy: { email: 'manager@example.test', name: 'Manager', role: 'manager' },
      },
      {
        operationId: structure.operationId, entityKind: 'goal', sourceId: structure.sourceId,
        sourceExecutionId: structure.sourceExecutionId, action: structure.action,
        reason: 'Approved in minute two', completedAt: '2027-02-02T01:00:00.000Z',
        impact: structure, sourceSnapshot: { title: 'Market supervision' },
      },
    ],
  })], { divisionId: 'lic', divisionName: 'Licensing' }, '2027-02-03T00:00:00.000Z');

  assert.equal(history.summary.total, 2);
  assert.equal(history.summary.completed, 2);
  assert.equal(history.summary.reassignments, 1);
  assert.equal(history.summary.clearedLinks, 1);
  assert.equal(history.events[0].entityKind, 'goal');
  assert.deepEqual(history.events[0].affected, { objectives: 1, kras: 1, kpis: 1, tasks: 2 });
  assert.equal(history.events[1].performedBy.email, 'manager@example.test');
  assert.equal(history.events[1].evidence.measurementEvidenceRefs, 2);
  assert.equal(history.events.every(event => event.reversalAvailable === false), true);
  assert.equal(Object.isFrozen(history), true);
  assert.equal(Object.isFrozen(history.events[0].affected), true);
});

test('failed operation exposes checkpoints, error and same-intent recovery guidance', () => {
  const impact = activityImpact();
  const history = buildWorkPlanGovernanceHistory([item({
    version: 1, history: [],
    operation: {
      version: 1, entityKind: 'activity', operationId: impact.operationId, state: 'failed', leaseUntil: 0,
      completedSteps: ['kpi', 'task:30'], reason: 'Approved recovery', impact,
      activitySnapshot: { title: 'Review applications' }, error: 'Objective rollup raced.',
      performedBy: { email: 'manager@example.test', name: 'Manager' },
    },
  })], { divisionId: 'lic', divisionName: 'Licensing' });
  assert.equal(history.summary.failed, 1);
  assert.deepEqual(history.events[0].completedSteps, ['kpi', 'task:30']);
  assert.match(history.events[0].error, /rollup raced/);
  assert.match(history.events[0].recoveryGuidance, /same reviewed operation/);
});

test('malformed journals, duplicate operations and cross-Division rows fail closed', () => {
  const malformed = item({ version: 2, history: [] });
  assert.throws(() => buildWorkPlanGovernanceHistory([malformed], { divisionId: 'lic', divisionName: 'Licensing' }), /unsupported/);

  const mismatched = item({ version: 1, history: [] });
  mismatched.fields.DivisionName = 'Corporate Services';
  assert.throws(() => buildWorkPlanGovernanceHistory([mismatched], { divisionId: 'lic', divisionName: 'Licensing' }), /does not match/);

  const impact = activityImpact();
  const record = {
    operationId: impact.operationId, activityId: impact.activityId, action: impact.action, reason: 'Approved',
    completedAt: '2027-02-01T01:00:00.000Z', sourceKraId: '10', kpiId: '20', taskIds: ['30'],
    impact, activitySnapshot: { title: 'Review applications' },
  };
  assert.throws(() => buildWorkPlanGovernanceHistory([item({ version: 1, history: [record, record] })], { divisionId: 'lic', divisionName: 'Licensing' }), /Duplicate/);
});
