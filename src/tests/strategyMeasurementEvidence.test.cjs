const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const servicePath = path.resolve(__dirname, '../services/strategyExecutionGraphService.ts');
const output = ts.transpileModule(fs.readFileSync(servicePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  fileName: servicePath,
}).outputText;
const normalizeLookupString = value => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized && !['none', 'null', 'undefined', 'nan'].includes(normalized.toLowerCase()) ? normalized : null;
};
const serviceModule = { exports: {} };
vm.runInThisContext(`(function(require, module, exports) { ${output}\n})`, { filename: servicePath })(
  request => request === '@/utils/sharePointLookupUtils'
    ? { normalizeLookupString }
    : (() => { throw new Error(`Unexpected import: ${request}`); })(),
  serviceModule,
  serviceModule.exports,
);
const { buildStrategyExecutionGraph } = serviceModule.exports;

const definition = (mode, extra = {}) => ({ mode, rawTarget: extra.rawTarget || String(extra.target ?? mode), ...extra });
const evidence = extra => ({ windowStart: '2027-01-01', windowEnd: '2027-03-31', asOf: '2027-03-31', ...extra });
const graphFor = (measurementDefinition, measurementEvidence, extra = {}) => buildStrategyExecutionGraph({
  strategicGoals: [{ id: 'g1', title: 'Goal' }],
  performanceRecords: [{
    id: 'k1',
    title: 'Measured KPI',
    ownerRole: 'officer',
    parentStrategicGoalId: 'g1',
    measurementDefinition,
    measurementEvidence,
    ...extra,
  }],
  tasks: extra.tasks || [],
});
const nodeFor = graph => graph.lookups.performanceRecordsById.k1;

test('count evidence calculates attainment without changing the legacy manual mode', () => {
  const node = nodeFor(graphFor(definition('count', { target: 12, unit: 'meetings' }), evidence({ actual: 6, evidenceRefs: ['minutes-1'] }), { calculationType: 'manual' }));
  assert.equal(node.progress.value, 50);
  assert.equal(node.progress.source, 'specialized-measurement');
  assert.equal(node.progress.measurement.actual, 6);
  assert.equal(node.progress.measurement.targetMet, false);
  assert.equal(node.calculationType, 'manual');
});

test('percentage evidence reports measured performance separately from target attainment', () => {
  const node = nodeFor(graphFor(definition('percentage', { target: 95, unit: '%' }), evidence({ actual: 90 })));
  assert.equal(node.progress.value, 95);
  assert.equal(node.progress.measurement.actual, 90);
  assert.equal(node.progress.measurement.target, 95);
  assert.equal(node.progress.measurement.targetMet, false);
});

test('service-level evidence uses compliant and eligible cases, not completed Tasks', () => {
  const graph = graphFor(
    definition('service-level', { target: 95, population: 'eligible applications', serviceLevel: 'within 5 working days' }),
    evidence({ compliantCount: 94, eligibleCount: 100, evidenceRefs: ['case-register'] }),
    {
      status: 'completed',
      tasks: [{ id: 't1', title: 'One assessment', status: 'completed', completed: true, kpi_id: 'k1' }],
    },
  );
  const node = nodeFor(graph);
  assert.equal(node.progress.value, 99);
  assert.equal(node.progress.measurement.targetMet, false);
  assert.match(node.progress.warnings.join(' '), /supporting records only/);
});

test('population coverage requires a real eligible denominator', () => {
  const node = nodeFor(graphFor(definition('population', { target: 100, population: 'high and extreme risks' }), evidence({ compliantCount: 8, eligibleCount: 10 })));
  assert.equal(node.progress.value, 80);
  assert.equal(node.progress.measurement.numerator, 8);
  assert.equal(node.progress.measurement.denominator, 10);
});

test('at-most duration scores the share of observations meeting the allowance', () => {
  const node = nodeFor(graphFor(
    definition('duration-at-most', { target: 5, unit: 'working days', timeAllowance: { value: 5, unit: 'working days' } }),
    evidence({ observations: [{ value: 4 }, { value: 5 }, { value: 7 }] }),
  ));
  assert.equal(node.progress.value, 67);
  assert.equal(node.progress.measurement.numerator, 2);
  assert.equal(node.progress.measurement.denominator, 3);
  assert.equal(node.progress.measurement.targetMet, false);
});

test('recurrence evidence retains the occurrence denominator across quarters', () => {
  const node = nodeFor(graphFor(definition('recurrence', { target: 12, frequency: 'monthly' }), evidence({ completedOccurrences: 8, expectedOccurrences: 12 })));
  assert.equal(node.progress.value, 67);
  assert.equal(node.progress.measurement.denominator, 12);
});

test('milestone evidence supports explicit weights and overdue warnings', () => {
  const node = nodeFor(graphFor(definition('milestone', { milestoneWindow: 'Q3' }), evidence({ milestones: [
    { id: 'design', completed: true, weight: 1, evidenceRef: 'approved-design' },
    { id: 'launch', completed: false, weight: 3, dueDate: '2026-01-01' },
  ] })));
  assert.equal(node.progress.value, 25);
  assert.equal(node.progress.measurement.targetMet, false);
  assert.match(node.progress.warnings.join(' '), /past due/);
});

test('continuous and as-required work fail closed when no reporting-window demand exists', () => {
  for (const mode of ['continuous', 'as-required']) {
    const graph = graphFor(definition(mode, { frequency: mode }), evidence({ expectedOccurrences: 0, completedOccurrences: 0 }));
    const node = nodeFor(graph);
    assert.equal(node.progress.hasLinkedData, false);
    assert.equal(node.progress.measurement.state, 'missing-evidence');
    assert.ok(graph.diagnostics.some(item => item.id === `measurement-missing-evidence:k1`));
  }
});

test('impossible specialized evidence is diagnosed and excluded from parent rollups', () => {
  const graph = graphFor(definition('service-level', { target: 95 }), evidence({ compliantCount: 11, eligibleCount: 10 }));
  const node = nodeFor(graph);
  assert.equal(node.progress.hasLinkedData, false);
  assert.equal(node.progress.measurement.state, 'invalid');
  assert.ok(graph.diagnostics.some(item => item.id === 'measurement-invalid:k1' && item.severity === 'error'));
  assert.equal(graph.goals[0].progress.hasLinkedData, false);
});

test('direct specialized evidence on a parent is preserved without replacing its child rollup', () => {
  const graph = buildStrategyExecutionGraph({
    strategicGoals: [{ id: 'g1', title: 'Goal' }],
    performanceRecords: [
      {
        id: 'parent', title: 'Parent measure', ownerRole: 'manager', parentStrategicGoalId: 'g1',
        measurementDefinition: definition('count', { target: 4 }),
        measurementEvidence: evidence({ actual: 4, evidenceRefs: ['parent-register'] }),
      },
      {
        id: 'leaf', title: 'Leaf', ownerRole: 'officer', parentId: 'parent', calculationType: 'checklist',
        checklist: [{ id: 'a', checked: true }, { id: 'b', checked: false }],
      },
    ],
  });
  const parent = graph.lookups.performanceRecordsById.parent;
  assert.equal(parent.progress.value, 50);
  assert.equal(parent.measurementEvidence.actual, 4);
  assert.equal(parent.evidenceCount, 1);
  assert.ok(graph.diagnostics.some(item => item.id === 'direct-evidence-on-parent:parent'));
});

test('specialized evidence on a parent is preserved but does not silently replace child rollups', () => {
  const graph = buildStrategyExecutionGraph({
    strategicGoals: [{ id: 'g1', title: 'Goal' }],
    performanceRecords: [
      {
        id: 'parent', title: 'Parent', ownerRole: 'manager', parentStrategicGoalId: 'g1',
        measurementDefinition: definition('count', { target: 10 }),
        measurementEvidence: evidence({ actual: 10, evidenceRefs: ['parent-register'] }),
      },
      { id: 'child', title: 'Child', ownerRole: 'officer', parentId: 'parent', calculationType: 'manual', target: 10, actual: 5 },
    ],
  });
  const parent = graph.lookups.performanceRecordsById.parent;
  assert.equal(parent.progress.value, 50);
  assert.equal(parent.evidenceCount, 1);
  assert.ok(graph.diagnostics.some(item => item.id === 'direct-evidence-on-parent:parent'));
});
