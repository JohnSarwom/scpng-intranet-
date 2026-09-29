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
  selectStrategyAIArchive,
  strategyAIFilterRowCount,
  serializeArchivedStrategyAIContext,
  unsupportedStrategyAINumericFacts,
  assertStrategyAIResponseUsesArchivedNumbers,
} = load('../services/strategyReportAIService.ts');

function archive(type, label, generatedAt = '2027-02-01T00:00:00.000Z') {
  return {
    storageId: `stored-${type}-${label}`,
    record: {
      archiveVersion: 1,
      snapshotId: `snapshot-${type}-${label}`,
      snapshotChecksum: 'a'.repeat(64),
      archivedAt: generatedAt,
      archivedBy: { email: 'manager@example.test', name: 'Manager' },
      scope: { type, label, division: type === 'division' ? label : undefined },
      presentationConfig: {}, retention: { mode: 'hold-until-policy-approved' }, deliveryHistory: [],
      snapshot: {
        id: `snapshot-${type}-${label}`, title: 'Frozen report', type: 'strategic-traceability', scope: type,
        generatedAt, generatedBy: 'Manager',
        dateRange: { start: '2027-01-01T00:00:00.000Z', end: '2027-01-31T23:59:59.999Z' },
        source: 'graph', goals: [], diagnostics: [], integrity: { isConserved: true },
        summary: { taskCount: 12, evidenceCount: 8, averageProgress: 40 },
        snapshot: {
          version: 1, immutable: true, capturedAt: generatedAt, graphGeneratedAt: generatedAt,
          scopeLabel: label, dateBasis: 'task-interval-overlap-and-completion-events',
          dataSourceSummary: 'Conserved graph', progressFormula: 'Frozen graph rollup',
        },
        sections: [
          { id: 'traceability', title: 'Traceability', rows: [{ entityType: 'task', entityId: 't1', title: 'File reviews', parentPath: 'Goal', progress: 40 }] },
          { id: 'overdue', title: 'Overdue', rows: [{ entityType: 'task', entityId: 't2', title: 'Inspect issuer', parentPath: 'Goal', evidenceCount: 8 }] },
          { id: 'progress-variance', title: 'Variance', rows: [] },
        ],
      },
    },
  };
}

test('Division selection is exact and never falls back across scope', () => {
  const licensing = archive('division', 'Licensing');
  const corporateServices = archive('division', 'Corporate Services');
  assert.equal(selectStrategyAIArchive([corporateServices, licensing], { audience: 'division', division: ' licensing ' }), licensing);
  assert.throws(() => selectStrategyAIArchive([corporateServices], { audience: 'division', division: 'Licensing' }), /No authorized archived report/);
  assert.throws(() => selectStrategyAIArchive([licensing], { audience: 'division' }), /exact Division identity/);
});

test('Strategy selection prefers corporate evidence and otherwise preserves newest authorized scope', () => {
  const division = archive('division', 'Licensing');
  const corporate = archive('corporate', 'Corporate');
  assert.equal(selectStrategyAIArchive([division, corporate], { audience: 'strategy' }), corporate);
  assert.equal(selectStrategyAIArchive([division], { audience: 'strategy' }), division);
  assert.throws(() => selectStrategyAIArchive([], { audience: 'strategy' }), /No authorized archived strategy report/);
});

test('AI context contains archive identity, provenance, summary and only selected frozen sections', () => {
  const stored = archive('division', 'Licensing');
  const all = serializeArchivedStrategyAIContext(stored, 'all');
  assert.match(all, /ARCHIVE_STORAGE_ID: stored-division-Licensing/);
  assert.match(all, /SNAPSHOT_SHA256: a{64}/);
  assert.match(all, /PROGRESS_FORMULA: Frozen graph rollup/);
  assert.match(all, /File reviews/);
  assert.equal(strategyAIFilterRowCount(stored, 'all'), 2);
  assert.equal(strategyAIFilterRowCount(stored, 'delivery-risks'), 1);
  const risks = serializeArchivedStrategyAIContext(stored, 'delivery-risks');
  assert.match(risks, /Inspect issuer/);
  assert.doesNotMatch(risks, /File reviews/);
});

test('numeric guard permits archived facts and markdown numbering but rejects invented figures', () => {
  const context = serializeArchivedStrategyAIContext(archive('division', 'Licensing'));
  assert.doesNotThrow(() => assertStrategyAIResponseUsesArchivedNumbers('1. Progress is 40% with 12 Tasks and 8 evidence records.', context));
  assert.deepEqual([...unsupportedStrategyAINumericFacts('Progress is 75% and there are 14 Tasks.', context)], ['14', '75']);
  assert.throws(() => assertStrategyAIResponseUsesArchivedNumbers('Progress is 75%.', context), /withheld/);
});
