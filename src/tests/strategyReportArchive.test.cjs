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

const {
  StrategyReportArchiveService,
  SharePointStrategyReportArchiveStore,
  canAccessStrategyReport,
  createStrategyReportScheduleBinding,
  buildStrategyReportDispatchEnvelope,
  assertStrategyReportSchedulerDeployment,
  assertLegacyReportFlowQuarantined,
} = load('../services/strategyReportArchiveService.ts');

const actor = (fields = {}) => ({
  email: 'manager@example.test', name: 'Manager One', role: 'manager',
  division: 'Licensing', unit: 'Supervision', isAdmin: false, ...fields,
});

const snapshot = (scope = 'division', label = 'Licensing') => ({
  id: `strategy-report:${scope}:2027-02-01`, title: 'January traceability', type: 'strategic-traceability',
  scope, generatedAt: '2027-02-01T00:00:00.000Z', generatedBy: 'Manager One',
  dateRange: { start: '2027-01-01T00:00:00.000Z', end: '2027-01-31T23:59:59.999Z' },
  source: 'graph', goals: [], diagnostics: [], sections: [], summary: {},
  snapshot: {
    version: 1, graphGeneratedAt: '2027-02-01T00:00:00.000Z', capturedAt: '2027-02-01T00:00:00.000Z',
    immutable: true, dateBasis: 'task-interval-overlap-and-completion-events', scopeLabel: label,
    dataSourceSummary: 'Conserved graph', progressFormula: 'Graph rollup',
  },
  integrity: { isConserved: true },
});

function harness(currentActor = actor()) {
  const records = [];
  const deliveries = [];
  const store = {
    async append(record) { records.push(record); return { storageId: `stored-${records.length}` }; },
    async list() { return records.map((record, index) => ({ storageId: `stored-${index + 1}`, record })); },
    async appendDelivery(record) { deliveries.push(record); return { storageId: `delivery-${deliveries.length}` }; },
    async listDeliveries(snapshotIds) { return deliveries
      .filter(record => snapshotIds.includes(record.snapshotId))
      .map((record, index) => ({ storageId: `delivery-${index + 1}`, record })); },
  };
  const identity = { async current() { return currentActor; } };
  return {
    records,
    deliveries,
    service: new StrategyReportArchiveService(
      store, identity, () => '2027-02-01T00:01:00.000Z', () => `event-${deliveries.length + 1}`,
    ),
  };
}

test('authorized generation appends one immutable checksummed Division snapshot', async () => {
  const { service, records } = harness();
  const config = { timePeriod: 'monthly', includeCharts: true };
  const saved = await service.archive(snapshot(), config, { division: 'Licensing' });
  assert.equal(saved.storageId, 'stored-1');
  assert.equal(records.length, 1);
  assert.match(saved.record.snapshotChecksum, /^[a-f0-9]{64}$/);
  assert.equal(saved.record.retention.mode, 'hold-until-policy-approved');
  assert.deepEqual(saved.record.deliveryHistory, []);
  assert.equal(Object.isFrozen(saved.record.snapshot), true);
  config.timePeriod = 'daily';
  assert.equal(saved.record.presentationConfig.timePeriod, 'monthly');
});

test('archive authorization fails closed before storage writes', async () => {
  for (const [currentActor, report, identity, message] of [
    [actor({ division: 'Corporate Services' }), snapshot(), { division: 'Licensing' }, /permission/],
    [actor({ role: 'staff' }), snapshot(), { division: 'Licensing' }, /manager, director or administrator/],
    [null, snapshot(), { division: 'Licensing' }, /verify the signed-in report user/],
    [actor(), snapshot('unit', 'Supervision'), { division: 'Licensing', unit: 'Different Unit' }, /does not match/],
    [actor(), snapshot('personal', 'Manager One'), { division: 'Licensing' }, /owner email/],
  ]) {
    const { service, records } = harness(currentActor);
    await assert.rejects(service.archive(report, {}, identity), message);
    assert.equal(records.length, 0);
  }
});

test('history verifies checksums and returns only records in the authoritative scope', async () => {
  const { service, records } = harness();
  await service.archive(snapshot(), {}, { division: 'Licensing' });
  const personal = snapshot('personal', 'Manager One');
  personal.id = 'personal-report';
  await service.archive(personal, {}, { ownerEmail: 'manager@example.test' });
  const history = await service.history();
  assert.equal(history.length, 2);
  assert.equal(Object.isFrozen(history), true);
  records[0] = structuredClone(records[0]);
  records[0].snapshot.title = 'Tampered title';
  await assert.rejects(service.history(), /failed its snapshot checksum/);
});

test('scope reads are exact and administrators can read corporate archives', () => {
  const scope = { type: 'unit', label: 'Supervision', division: 'Licensing', unit: 'Supervision' };
  assert.equal(canAccessStrategyReport(actor(), scope), true);
  assert.equal(canAccessStrategyReport(actor({ unit: 'Policy' }), scope), false);
  assert.equal(canAccessStrategyReport(actor({ isAdmin: true, role: 'admin', division: '', unit: '' }), { type: 'corporate', label: 'Corporate' }), true);
  assert.equal(canAccessStrategyReport(actor(), { type: 'audit', label: 'Audit' }), false);
});

test('delivery lifecycle is append-only, authorized and hydrated into history', async () => {
  const { service, deliveries } = harness();
  const saved = await service.archive(snapshot(), {}, { division: 'Licensing' });
  const event = await service.recordDelivery(saved.record, {
    channel: 'email', status: 'sent', recipient: 'board@example.test',
  });
  assert.equal(event.record.event.id, 'event-1');
  assert.match(event.record.eventChecksum, /^[a-f0-9]{64}$/);
  assert.equal(deliveries.length, 1);
  const history = await service.history();
  assert.equal(history[0].record.deliveryHistory.length, 1);
  assert.equal(history[0].record.deliveryHistory[0].recipient, 'board@example.test');
  assert.equal(Object.isFrozen(history[0].record.deliveryHistory), true);
  await assert.rejects(service.recordDelivery(saved.record, { channel: 'email', status: 'failed', recipient: 'board@example.test' }), /error description/);
  assert.equal(deliveries.length, 1);
});

test('delivery events reject unauthorized scope, invalid recipient and snapshot tampering before writes', async () => {
  const source = harness();
  const saved = await source.service.archive(snapshot(), {}, { division: 'Licensing' });
  const denied = harness(actor({ division: 'Corporate Services' }));
  await assert.rejects(denied.service.recordDelivery(saved.record, { channel: 'download', status: 'sent' }), /permission/);
  await assert.rejects(source.service.recordDelivery(saved.record, { channel: 'email', status: 'queued' }), /recipient/);
  const tampered = structuredClone(saved.record);
  tampered.snapshot.title = 'Changed';
  await assert.rejects(source.service.recordDelivery(tampered, { channel: 'download', status: 'sent' }), /failed its (snapshot )?checksum/);
  assert.equal(source.deliveries.length, 0);
  assert.equal(denied.deliveries.length, 0);
});

test('SharePoint adapter stores and restores the archive envelope without recomputing it', async () => {
  const persisted = [];
  const gateway = {
    async saveReport(report) { persisted.push({ ...report, id: 'sp-7' }); return persisted[0]; },
    async getReports() { return [...persisted.map(item => ({ ...item })), { id: 'legacy', template_id: 'legacy', content: {} }]; },
  };
  const store = new SharePointStrategyReportArchiveStore(gateway);
  const { service } = harness();
  const generated = await service.archive(snapshot(), {}, { division: 'Licensing' });
  const result = await store.append(generated.record);
  assert.equal(result.storageId, 'sp-7');
  assert.equal(persisted[0].template_id, 'strategy-report-archive-v1');
  const loaded = await store.list(10);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].record.snapshotChecksum, generated.record.snapshotChecksum);
  const delivery = await service.recordDelivery(generated.record, { channel: 'download', status: 'sent' });
  const deliveryResult = await store.appendDelivery(delivery.record);
  assert.equal(deliveryResult.storageId, 'sp-7');
  const loadedDeliveries = await store.listDeliveries([generated.record.snapshotId], 10);
  assert.equal(loadedDeliveries.length, 1);
  assert.equal(loadedDeliveries[0].record.eventChecksum, delivery.record.eventChecksum);
});

test('schedule binding freezes the exact authorized archive identity for dispatch', async () => {
  const { service } = harness();
  const archive = await service.archive(snapshot(), {}, { division: 'Licensing' });
  const binding = await createStrategyReportScheduleBinding(
    archive, actor(), 'recipient@example.test', 'director@example.test',
    () => '2027-02-01T01:00:00.000Z',
  );
  assert.equal(binding.archiveStorageId, 'stored-1');
  assert.equal(binding.snapshotChecksum, archive.record.snapshotChecksum);
  assert.equal(Object.isFrozen(binding), true);
  const dispatch = await buildStrategyReportDispatchEnvelope(binding, archive);
  assert.deepEqual(dispatch.snapshot, archive.record.snapshot);
  assert.notEqual(dispatch.snapshot, archive.record.snapshot);
  assert.equal(dispatch.snapshot.id, binding.snapshotId);
  assert.equal(Object.isFrozen(dispatch.snapshot), true);
});

test('schedule binding rejects unauthorized actors, invalid recipients and archive mismatch', async () => {
  const { service } = harness();
  const archive = await service.archive(snapshot(), {}, { division: 'Licensing' });
  await assert.rejects(
    createStrategyReportScheduleBinding(archive, actor({ role: 'staff' }), 'recipient@example.test'),
    /manager, director or administrator/,
  );
  await assert.rejects(createStrategyReportScheduleBinding(archive, actor(), 'not-an-email'), /valid email/);
  const binding = await createStrategyReportScheduleBinding(archive, actor(), 'recipient@example.test');
  const changed = structuredClone(binding);
  changed.snapshotChecksum = '0'.repeat(64);
  await assert.rejects(buildStrategyReportDispatchEnvelope(changed, archive), /does not match/);
});

test('scheduler deployment remains blocked until every archive and journal gate is verified', () => {
  assert.throws(() => assertStrategyReportSchedulerDeployment(), /deployment is blocked/);
  assert.throws(() => assertStrategyReportSchedulerDeployment({
    contractVersion: 1,
    archiveTemplateId: 'strategy-report-archive-v1',
    deliveryTemplateId: 'strategy-report-delivery-v1',
    executorId: 'strategy-report-scheduled-delivery-v1',
    scheduleSnapshotFieldsVerified: true,
    dispatchReadsArchiveByIdAndChecksum: true,
    deliveryJournalWritesVerified: false,
    scheduleLeaseAndCheckpointWritesVerified: true,
    idempotentEmailSendVerified: true,
  }), /deployment is blocked/);
  assert.doesNotThrow(() => assertStrategyReportSchedulerDeployment({
    contractVersion: 1,
    archiveTemplateId: 'strategy-report-archive-v1',
    deliveryTemplateId: 'strategy-report-delivery-v1',
    executorId: 'strategy-report-scheduled-delivery-v1',
    scheduleSnapshotFieldsVerified: true,
    dispatchReadsArchiveByIdAndChecksum: true,
    deliveryJournalWritesVerified: true,
    scheduleLeaseAndCheckpointWritesVerified: true,
    idempotentEmailSendVerified: true,
  }));
  assert.throws(() => assertLegacyReportFlowQuarantined(), /legacy report flows are quarantined/i);
});
