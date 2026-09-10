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
const adaptersModule = load('../services/strategyReportTenantAdapters.ts', {
  './strategyReportArchiveService': archiveModule,
});

const {
  StrategyReportArchiveService,
  createStrategyReportDeliveryRecord,
} = archiveModule;
const {
  SharePointStrategyReportScheduledArchiveReader,
  SharePointStrategyReportScheduledDeliveryJournal,
  SharePointStrategyReportScheduleCheckpointStore,
  ResendStrategyReportEmailSender,
  assertSchedulerExecutorLeastPrivilege,
  createSharePointSchedulerTenantAdapters,
} = adaptersModule;

function graph(handler) {
  const requests = [];
  return {
    requests,
    client: {
      api(url) {
        const request = { url, headers: {} };
        requests.push(request);
        const chain = {
          expand(value) { request.expand = value; return chain; },
          filter(value) { request.filter = value; return chain; },
          top(value) { request.top = value; return chain; },
          header(name, value) { request.headers[name] = value; return chain; },
          get() { request.method = 'GET'; return handler(request); },
          post(body) { request.method = 'POST'; request.body = body; return handler(request); },
          patch(body) { request.method = 'PATCH'; request.body = body; return handler(request); },
        };
        return chain;
      },
    },
  };
}

const actor = { email: 'scheduler@example.test', name: 'Scheduler', role: 'admin', isAdmin: true };
const snapshot = () => ({
  id: 'strategy-report:corporate:2027-03-01', title: 'Monthly report', type: 'strategic-traceability',
  scope: 'corporate', generatedAt: '2027-03-01T00:00:00.000Z', generatedBy: 'Scheduler',
  dateRange: { start: '2027-02-01T00:00:00.000Z', end: '2027-02-28T23:59:59.999Z' },
  source: 'graph', goals: [], diagnostics: [], sections: [],
  summary: {
    strategicGoalCount: 1, organisationalKraCount: 1, divisionCount: 1, unitCount: 1,
    objectiveCount: 1, performanceKraCount: 1, kpiCount: 1, taskCount: 1,
    evidenceCount: 1, diagnosticCount: 0, averageProgress: 50,
  },
  snapshot: {
    version: 1, graphGeneratedAt: '2027-03-01T00:00:00.000Z', capturedAt: '2027-03-01T00:00:00.000Z',
    immutable: true, dateBasis: 'task-interval-overlap-and-completion-events', scopeLabel: 'SCPNG',
    dataSourceSummary: 'Conserved graph', progressFormula: 'Frozen graph rollup',
  },
  integrity: { isConserved: true },
});

async function archiveFixture() {
  let stored;
  const service = new StrategyReportArchiveService(
    {
      async append(record) { stored = record; return { storageId: '41' }; },
      async list() { return stored ? [{ storageId: '41', record: stored }] : []; },
      async appendDelivery() { return { storageId: 'delivery-1' }; },
      async listDeliveries() { return []; },
    },
    { async current() { return actor; } },
    () => '2027-03-01T00:05:00.000Z',
  );
  return service.archive(snapshot(), {}, {});
}

const reportItem = archive => ({
  id: archive.storageId,
  eTag: '"archive-etag"',
  fields: {
    ReportType: 'strategy-report-archive-v1',
    ContentJSON: JSON.stringify({ archive: archive.record }),
  },
});

test('archive reader uses one exact item GET and checksum-verifies the immutable archive', async () => {
  const archive = await archiveFixture();
  const source = graph(request => {
    assert.equal(request.method, 'GET');
    return reportItem(archive);
  });
  const reader = new SharePointStrategyReportScheduledArchiveReader(source.client, 'site-1', 'reports-1');
  const stored = await reader.getByStorageId('41');
  assert.equal(stored.storageId, '41');
  assert.equal(stored.record.snapshotId, archive.record.snapshotId);
  assert.equal(source.requests.length, 1);
  assert.equal(source.requests[0].url, '/sites/site-1/lists/reports-1/items/41');
  assert.match(source.requests[0].expand, /ReportType,ContentJSON/);
});

test('archive reader returns null only for a real 404 and rejects a tampered snapshot', async () => {
  const missing = graph(() => Promise.reject(Object.assign(new Error('missing'), { statusCode: 404 })));
  const reader = new SharePointStrategyReportScheduledArchiveReader(missing.client, 'site-1', 'reports-1');
  assert.equal(await reader.getByStorageId('404'), null);

  const archive = await archiveFixture();
  const item = reportItem(archive);
  const content = JSON.parse(item.fields.ContentJSON);
  content.archive.snapshot.title = 'tampered';
  item.fields.ContentJSON = JSON.stringify(content);
  const changed = graph(() => item);
  await assert.rejects(
    new SharePointStrategyReportScheduledArchiveReader(changed.client, 'site-1', 'reports-1').getByStorageId('41'),
    /failed its snapshot checksum/,
  );
});

test('delivery journal filters on ReportType, verifies checksums, and appends with POST only', async () => {
  const archive = await archiveFixture();
  const delivery = await createStrategyReportDeliveryRecord(
    archive.record,
    { channel: 'email', status: 'queued', recipient: 'board@example.test', scheduleId: '7', dispatchId: 'dispatch-7' },
    actor.email,
    () => '2027-03-01T00:10:00.000Z',
    () => 'event-1',
  );
  const source = graph(request => {
    if (request.method === 'GET') return {
      value: [{
        id: '88',
        fields: {
          ReportType: 'strategy-report-delivery-v1',
          ContentJSON: JSON.stringify({ delivery }),
        },
      }],
    };
    if (request.method === 'POST') return { id: '89' };
    throw new Error(`Unexpected ${request.method}`);
  });
  const journal = new SharePointStrategyReportScheduledDeliveryJournal(
    source.client, 'site-1', 'reports-1', actor.email,
    () => '2027-03-01T00:11:00.000Z', () => 'event-2',
  );
  const events = await journal.listVerified(archive);
  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'event-1');
  assert.equal(source.requests[0].filter, "fields/ReportType eq 'strategy-report-delivery-v1'");
  await journal.record(archive, {
    channel: 'email', status: 'sent', recipient: 'board@example.test',
    scheduleId: '7', dispatchId: 'dispatch-7', providerMessageId: 'provider-7',
  });
  const write = source.requests.find(request => request.method === 'POST');
  assert.equal(write.url, '/sites/site-1/lists/reports-1/items');
  assert.equal(write.body.fields.ReportType, 'strategy-report-delivery-v1');
  assert.equal(JSON.parse(write.body.fields.ContentJSON).delivery.event.providerMessageId, 'provider-7');
  assert.equal(source.requests.some(request => ['PATCH', 'DELETE'].includes(request.method)), false);
});

test('delivery journal fails closed when a stored event checksum is invalid', async () => {
  const archive = await archiveFixture();
  const frozenDelivery = await createStrategyReportDeliveryRecord(
    archive.record,
    { channel: 'email', status: 'queued', recipient: 'board@example.test', scheduleId: '7', dispatchId: 'dispatch-7' },
    actor.email,
  );
  const delivery = structuredClone(frozenDelivery);
  delivery.event.recipient = 'changed@example.test';
  const source = graph(() => ({
    value: [{ id: '88', fields: { ReportType: 'strategy-report-delivery-v1', ContentJSON: JSON.stringify({ delivery }) } }],
  }));
  const journal = new SharePointStrategyReportScheduledDeliveryJournal(source.client, 'site-1', 'reports-1', actor.email);
  await assert.rejects(journal.listVerified(archive), /failed its event checksum/);
});

test('checkpoint store claims and completes a dispatch with current ETags and durable provider ID', async () => {
  const schedule = {
    id: '7', eTag: '"1"',
    fields: { DispatchId: '', DispatchState: '', LeaseUntil: null, LastProviderMessageId: null },
  };
  const source = graph(request => {
    if (request.method === 'GET') return structuredClone(schedule);
    if (request.method === 'PATCH') {
      assert.equal(request.headers['If-Match'], schedule.eTag);
      Object.assign(schedule.fields, request.body);
      schedule.eTag = schedule.eTag === '"1"' ? '"2"' : '"3"';
      return structuredClone(schedule.fields);
    }
    throw new Error(`Unexpected ${request.method}`);
  });
  const checkpoints = new SharePointStrategyReportScheduleCheckpointStore(
    source.client, 'site-1', 'schedules-1', () => '2027-03-01T00:00:00.000Z',
  );
  assert.equal(await checkpoints.claim({
    scheduleId: '7', dispatchId: 'dispatch-7', scheduledFor: '2027-03-01T00:00:00.000Z',
    leaseUntil: '2027-03-01T00:05:00.000Z',
  }), 'acquired');
  assert.equal(schedule.fields.DispatchState, 'leased');
  await checkpoints.markSent('7', 'dispatch-7', '2027-03-01T00:01:00.000Z', 'provider-7');
  assert.equal(schedule.fields.DispatchState, 'sent');
  assert.equal(schedule.fields.LastProviderMessageId, 'provider-7');
  assert.equal(schedule.fields.LeaseUntil, null);
  assert.equal(await checkpoints.claim({
    scheduleId: '7', dispatchId: 'dispatch-7', scheduledFor: '2027-03-01T00:00:00.000Z',
    leaseUntil: '2027-03-01T00:05:00.000Z',
  }), 'completed');
  assert.equal(source.requests.filter(request => request.method === 'PATCH').length, 2);
});

test('checkpoint claim returns busy for an active lease or a lost ETag race', async () => {
  const leased = graph(request => request.method === 'GET' ? ({
    id: '7', eTag: '"1"', fields: { DispatchId: 'other', DispatchState: 'leased', LeaseUntil: '2027-03-01T00:10:00.000Z' },
  }) : Promise.reject(new Error('patch should not run')));
  const busy = new SharePointStrategyReportScheduleCheckpointStore(
    leased.client, 'site-1', 'schedules-1', () => '2027-03-01T00:00:00.000Z',
  );
  const claim = { scheduleId: '7', dispatchId: 'dispatch-7', scheduledFor: '2027-03-01T00:00:00.000Z', leaseUntil: '2027-03-01T00:05:00.000Z' };
  assert.equal(await busy.claim(claim), 'busy');

  const raced = graph(request => request.method === 'GET'
    ? ({ id: '7', eTag: '"1"', fields: {} })
    : Promise.reject(Object.assign(new Error('stale'), { statusCode: 412 })));
  const conflict = new SharePointStrategyReportScheduleCheckpointStore(
    raced.client, 'site-1', 'schedules-1', () => '2027-03-01T00:00:00.000Z',
  );
  assert.equal(await conflict.claim(claim), 'busy');
});

test('Resend sender supplies the deterministic idempotency key and returns its durable email ID', async () => {
  let captured;
  const sender = new ResendStrategyReportEmailSender(
    { apiKey: 'secret-test-key', from: 'SCPNG Reports <reports@example.test>' },
    async (url, init) => {
      captured = { url, init };
      return { ok: true, status: 200, json: async () => ({ id: 'email-123' }) };
    },
  );
  const result = await sender.send({
    to: 'board@example.test', cc: 'director@example.test', subject: 'Report', html: '<p>Frozen report</p>',
    archiveStorageId: '41', snapshotId: 'snapshot-1', snapshotChecksum: 'a'.repeat(64),
  }, { idempotencyKey: 'b'.repeat(64) });
  assert.equal(result.messageId, 'email-123');
  assert.equal(captured.url, 'https://api.resend.com/emails');
  assert.equal(captured.init.headers['Idempotency-Key'], 'b'.repeat(64));
  assert.equal(JSON.parse(captured.init.body).to[0], 'board@example.test');
});

test('adapter factory rejects identities with access beyond the two selected lists', () => {
  const identity = {
    tenantId: 'tenant-1', principalId: 'principal-1', displayName: actor.email,
    permissionScope: 'Lists.SelectedOperations.Selected', permittedListIds: ['reports-1', 'schedules-1'],
  };
  assert.doesNotThrow(() => assertSchedulerExecutorLeastPrivilege(identity, 'reports-1', 'schedules-1'));
  const source = graph(() => ({}));
  const adapters = createSharePointSchedulerTenantAdapters(source.client, {
    siteId: 'site-1', reportsListId: 'reports-1', schedulesListId: 'schedules-1', identity,
  });
  assert.ok(adapters.archiveReader && adapters.journal && adapters.checkpoints);
  assert.throws(() => assertSchedulerExecutorLeastPrivilege(
    { ...identity, permittedListIds: [...identity.permittedListIds, 'other-list'] },
    'reports-1', 'schedules-1',
  ), /restricted to exactly/);
});
