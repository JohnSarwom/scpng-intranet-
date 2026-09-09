const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const filename = path.resolve(__dirname, file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = specifier => dependencies[specifier] || require(specifier);
  vm.runInThisContext(`(function(exports, require) { ${code}\n})`, { filename })(exports, localRequire);
  return exports;
}

const archiveModule = load('../services/strategyReportArchiveService.ts');
const {
  StrategyReportArchiveService,
  createStrategyReportScheduleBinding,
} = archiveModule;
const {
  StrategyReportScheduledDeliveryExecutor,
  createStrategyReportDispatchId,
  renderStrategyReportScheduledEmail,
} = load('../services/strategyReportSchedulerService.ts', {
  './strategyReportArchiveService': archiveModule,
});
const actor = () => ({
  email: 'manager@example.test', name: 'Manager One', role: 'manager',
  division: 'Licensing', unit: 'Supervision', isAdmin: false,
});

const snapshot = () => ({
  id: 'strategy-report:division:2027-02-01', title: 'January <Traceability>', type: 'strategic-traceability',
  scope: 'division', generatedAt: '2027-02-01T00:00:00.000Z', generatedBy: 'Manager One',
  dateRange: { start: '2027-01-01T00:00:00.000Z', end: '2027-01-31T23:59:59.999Z' },
  source: 'graph', goals: [], diagnostics: [], sections: [],
  summary: {
    strategicGoalCount: 2, organisationalKraCount: 3, divisionCount: 1, unitCount: 2,
    objectiveCount: 4, performanceKraCount: 5, kpiCount: 6, taskCount: 7,
    evidenceCount: 8, diagnosticCount: 1, averageProgress: 42,
  },
  snapshot: {
    version: 1, graphGeneratedAt: '2027-02-01T00:00:00.000Z', capturedAt: '2027-02-01T00:00:00.000Z',
    immutable: true, dateBasis: 'task-interval-overlap-and-completion-events', scopeLabel: 'Licensing',
    dataSourceSummary: 'Conserved <graph>', progressFormula: 'Frozen graph rollup',
  },
  integrity: { isConserved: true },
});

async function fixture() {
  const archives = [];
  const deliveries = [];
  const store = {
    async append(record) { archives.push(record); return { storageId: `archive-${archives.length}` }; },
    async list() { return archives.map((record, index) => ({ storageId: `archive-${index + 1}`, record })); },
    async appendDelivery(record) { deliveries.push(record); return { storageId: `delivery-${deliveries.length}` }; },
    async listDeliveries(snapshotIds) { return deliveries
      .filter(record => snapshotIds.includes(record.snapshotId))
      .map((record, index) => ({ storageId: `delivery-${index + 1}`, record })); },
  };
  const service = new StrategyReportArchiveService(
    store,
    { async current() { return actor(); } },
    () => '2027-02-01T01:00:00.000Z',
    () => `event-${deliveries.length + 1}`,
  );
  const archive = await service.archive(snapshot(), {}, { division: 'Licensing' });
  const binding = await createStrategyReportScheduleBinding(
    archive, actor(), 'board@example.test', 'director@example.test',
    () => '2027-02-01T00:15:00.000Z',
  );
  const request = {
    requestVersion: 1, scheduleId: 'schedule-7', scheduledFor: '2027-02-01T00:30:00.000Z', binding,
  };
  return { archive, binding, request, service, deliveries };
}

function adapters(source, options = {}) {
  const calls = [];
  let senderCalls = 0;
  const archiveReader = {
    async getByStorageId(id) {
      calls.push(`archive:${id}`);
      return options.archive === undefined ? source.archive : options.archive;
    },
  };
  const journal = {
    async listVerified() {
      calls.push('journal:list');
      const history = await source.service.history();
      return history[0].record.deliveryHistory;
    },
    async record(archive, request) {
      calls.push(`journal:${request.status}`);
      if (options.failJournalStatus === request.status) throw new Error(`${request.status} journal unavailable`);
      await source.service.recordDelivery(archive.record, request);
    },
  };
  const sender = {
    async send(message, sendOptions) {
      senderCalls += 1;
      calls.push(`send:${sendOptions.idempotencyKey}`);
      if (options.failSend) throw new Error('Mail provider unavailable');
      assert.equal(message.to, 'board@example.test');
      assert.equal(message.snapshotChecksum, source.binding.snapshotChecksum);
      return { messageId: 'provider-message-9' };
    },
  };
  let claimCount = 0;
  const checkpoints = {
    async claim(claim) {
      claimCount += 1;
      calls.push(`claim:${claim.dispatchId}`);
      return options.claimResults?.[claimCount - 1] || 'acquired';
    },
    async markSent(_scheduleId, dispatchId) { calls.push(`checkpoint:sent:${dispatchId}`); },
    async markFailed(_scheduleId, dispatchId, _failedAt, error) { calls.push(`checkpoint:failed:${dispatchId}:${error}`); },
  };
  return { archiveReader, journal, sender, checkpoints, calls, get senderCalls() { return senderCalls; } };
}

test('trusted executor sends only the checksum-verified archive and journals queued then sent', async () => {
  const source = await fixture();
  const io = adapters(source);
  const executor = new StrategyReportScheduledDeliveryExecutor(
    io.archiveReader, io.journal, io.sender, io.checkpoints,
    () => '2027-02-01T01:00:00.000Z',
  );
  const result = await executor.execute(source.request);
  assert.equal(result.status, 'sent');
  assert.equal(result.providerMessageId, 'provider-message-9');
  assert.match(result.dispatchId, /^[a-f0-9]{64}$/);
  assert.equal(io.senderCalls, 1);
  assert.deepEqual(source.deliveries.map(item => item.event.status), ['queued', 'sent']);
  assert.equal(source.deliveries[1].event.dispatchId, result.dispatchId);
  assert.equal(source.deliveries[1].event.scheduleId, 'schedule-7');
  assert.equal(source.deliveries[1].event.providerMessageId, 'provider-message-9');
  assert.equal(io.calls.at(-1), `checkpoint:sent:${result.dispatchId}`);
});

test('dispatch identity is deterministic and rendered HTML escapes archived text', async () => {
  const source = await fixture();
  const first = await createStrategyReportDispatchId(source.request);
  const second = await createStrategyReportDispatchId(structuredClone(source.request));
  assert.equal(first, second);
  const message = renderStrategyReportScheduledEmail({ dispatchVersion: 1, binding: source.binding, snapshot: source.archive.record.snapshot });
  assert.match(message.subject, /January <Traceability>/);
  assert.doesNotMatch(message.html, /<Traceability>/);
  assert.match(message.html, /January &lt;Traceability&gt;/);
  assert.match(message.html, /Average progress/);
  assert.equal(Object.isFrozen(message), true);
});

test('a retry with an existing sent dispatch repairs the checkpoint without sending again', async () => {
  const source = await fixture();
  const io = adapters(source);
  const executor = new StrategyReportScheduledDeliveryExecutor(
    io.archiveReader, io.journal, io.sender, io.checkpoints,
    () => '2027-02-01T01:00:00.000Z',
  );
  const first = await executor.execute(source.request);
  const second = await executor.execute(source.request);
  assert.equal(first.status, 'sent');
  assert.equal(second.status, 'already-sent');
  assert.equal(second.dispatchId, first.dispatchId);
  assert.equal(io.senderCalls, 1);
  assert.equal(source.deliveries.length, 2);
});

test('busy and future dispatches stop before archive reads, journal writes or email', async () => {
  const source = await fixture();
  const busy = adapters(source, { claimResults: ['busy'] });
  const busyExecutor = new StrategyReportScheduledDeliveryExecutor(
    busy.archiveReader, busy.journal, busy.sender, busy.checkpoints,
    () => '2027-02-01T01:00:00.000Z',
  );
  assert.equal((await busyExecutor.execute(source.request)).status, 'busy');
  assert.equal(busy.senderCalls, 0);
  assert.equal(busy.calls.some(call => call.startsWith('archive:')), false);

  const future = adapters(source);
  const futureExecutor = new StrategyReportScheduledDeliveryExecutor(
    future.archiveReader, future.journal, future.sender, future.checkpoints,
    () => '2027-02-01T00:00:00.000Z',
  );
  await assert.rejects(futureExecutor.execute(source.request), /not due yet/);
  assert.equal(future.calls.length, 0);
});

test('archive mismatch and queued-journal failure both prevent email sending', async () => {
  const source = await fixture();
  const changed = structuredClone(source.request);
  changed.binding.snapshotChecksum = '0'.repeat(64);
  const mismatch = adapters(source);
  const mismatchExecutor = new StrategyReportScheduledDeliveryExecutor(
    mismatch.archiveReader, mismatch.journal, mismatch.sender, mismatch.checkpoints,
    () => '2027-02-01T01:00:00.000Z',
  );
  await assert.rejects(mismatchExecutor.execute(changed), /does not match/);
  assert.equal(mismatch.senderCalls, 0);
  assert.equal(source.deliveries.length, 0);
  assert.equal(mismatch.calls.some(call => call.startsWith('checkpoint:failed:')), true);

  const journalFailure = adapters(source, { failJournalStatus: 'queued' });
  const journalExecutor = new StrategyReportScheduledDeliveryExecutor(
    journalFailure.archiveReader, journalFailure.journal, journalFailure.sender, journalFailure.checkpoints,
    () => '2027-02-01T01:00:00.000Z',
  );
  await assert.rejects(journalExecutor.execute(source.request), /queued journal unavailable/);
  assert.equal(journalFailure.senderCalls, 0);
});

test('provider failure appends a failed event and leaves the schedule recoverable', async () => {
  const source = await fixture();
  const io = adapters(source, { failSend: true });
  const executor = new StrategyReportScheduledDeliveryExecutor(
    io.archiveReader, io.journal, io.sender, io.checkpoints,
    () => '2027-02-01T01:00:00.000Z',
  );
  await assert.rejects(executor.execute(source.request), /Mail provider unavailable/);
  assert.deepEqual(source.deliveries.map(item => item.event.status), ['queued', 'failed']);
  assert.equal(source.deliveries[1].event.error, 'Mail provider unavailable');
  assert.equal(io.calls.some(call => call.startsWith('checkpoint:failed:')), true);
  assert.equal(io.calls.some(call => call.startsWith('checkpoint:sent:')), false);
});
