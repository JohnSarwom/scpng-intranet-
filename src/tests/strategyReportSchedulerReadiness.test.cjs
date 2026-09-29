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
  collectSchedulerTenantInventory,
  assessSchedulerTenantReadiness,
  SharePointSchedulerTenantReadOnlyInventoryGateway,
} = load('../services/strategyReportSchedulerReadinessService.ts');

const text = (name, indexed = false) => ({ name, text: {}, indexed });
const multiline = name => ({ name, text: { allowMultipleLines: true } });
const dateTime = (name, indexed = false) => ({ name, dateTime: {}, indexed });

function completeColumns() {
  return {
    Performance_Reports: [
      text('Title'), text('ReportType', true), text('GeneratedBy'), dateTime('StartDate'), dateTime('EndDate'),
      multiline('ContentJSON'), { name: 'AIAnalysis', boolean: {} }, { name: 'Status', choice: { choices: ['Generated'] } },
    ],
    Report_Schedules: [
      text('Title'), text('UserEmail'), text('ManagerEmail'), text('IsActive', true), dateTime('NextSendAt', true),
      dateTime('LastSentAt'), text('ArchiveStorageId', true), text('SnapshotId', true), text('SnapshotChecksum'),
      multiline('BindingJSON'), text('DispatchId', true), text('DispatchState'), dateTime('LeaseUntil'),
      text('LastProviderMessageId'), multiline('LastError'),
    ],
  };
}

function gateway(columns = completeColumns(), options = {}) {
  const calls = [];
  return {
    calls,
    async getListByName(name) {
      calls.push(`list:${name}`);
      if (options.failList === name) throw new Error(`${name} access denied`);
      if (options.missingList === name) return null;
      return { id: `id-${name}`, displayName: name, webUrl: `https://example.test/${name}` };
    },
    async getColumns(listId) {
      calls.push(`columns:${listId}`);
      const name = listId.replace('id-', '');
      return columns[name];
    },
    async sampleItemETag(listId) {
      calls.push(`etag:${listId}`);
      return options.noETag && listId === 'id-Report_Schedules' ? null : '"etag-1"';
    },
  };
}

const attestations = (fields = {}) => ({
  verifiedAt: '2027-02-10T00:00:00.000Z',
  evidenceReference: 'UAT-READINESS-17',
  leastPrivilegeServiceIdentity: true,
  exactArchiveReadByStorageId: true,
  appendOnlyDeliveryJournalWrites: true,
  conditionalScheduleLeaseAndCheckpointWrites: true,
  idempotentEmailSend: true,
  ...fields,
});

test('read-only inventory collects only list, column and ETag metadata', async () => {
  const source = gateway();
  const inventory = await collectSchedulerTenantInventory(
    source, 'SCPNG Scheduler UAT', 'non-production', () => '2027-02-10T01:00:00.000Z',
  );
  assert.equal(inventory.lists.length, 2);
  assert.equal(inventory.lists.every(list => list.exists), true);
  assert.equal(inventory.lists.find(list => list.name === 'Report_Schedules').sampleItemHasETag, true);
  assert.equal(source.calls.length, 6);
  assert.equal(source.calls.every(call => /^(list|columns|etag):/.test(call)), true);
  assert.equal(Object.isFrozen(inventory), true);
});

test('SharePoint inventory adapter issues only exact GET requests', async () => {
  const requests = [];
  const client = {
    api(url) {
      const request = { url, selectValue: '', topValue: undefined };
      requests.push(request);
      return {
        select(value) { request.selectValue = value; return this; },
        top(value) { request.topValue = value; return this; },
        async get() {
          request.method = 'GET';
          if (url.endsWith('/columns')) return { value: completeColumns()[url.includes('Report_Schedules') ? 'Report_Schedules' : 'Performance_Reports'] };
          if (url.endsWith('/items')) return { value: [{ id: '1', eTag: '"v1"' }] };
          const name = url.split('/').at(-1);
          return { id: name, displayName: name, webUrl: `https://example.test/${name}` };
        },
      };
    },
  };
  const adapter = new SharePointSchedulerTenantReadOnlyInventoryGateway(client, 'site-1');
  const inventory = await collectSchedulerTenantInventory(
    adapter, 'SCPNG Scheduler UAT', 'non-production', () => '2027-02-10T01:00:00.000Z',
  );
  assert.equal(inventory.lists.every(list => list.exists), true);
  assert.equal(requests.length, 6);
  assert.equal(requests.every(request => request.method === 'GET'), true);
  assert.equal(requests.filter(request => request.url.endsWith('/items')).every(request => request.topValue === 1), true);
  assert.equal(requests.some(request => request.url.includes('Report_Schedules')), true);
  assert.equal(requests.some(request => request.url.includes('Performance_Reports')), true);
});

test('complete schema permits adapter work but activation remains blocked without capability evidence', async () => {
  const inventory = await collectSchedulerTenantInventory(
    gateway(), 'SCPNG Scheduler UAT', 'non-production', () => '2027-02-10T01:00:00.000Z',
  );
  const manifest = assessSchedulerTenantReadiness(inventory, undefined, () => '2027-02-10T02:00:00.000Z');
  assert.equal(manifest.schemaReadyForAdapterImplementation, true);
  assert.equal(manifest.activationReady, false);
  assert.equal(manifest.deploymentContract, undefined);
  assert.equal(manifest.findings.some(finding => finding.code === 'capability-attestations-missing'), true);
});

test('missing, mistyped, unindexed and ETag-unverified schema all fail closed', async () => {
  const columns = completeColumns();
  columns.Performance_Reports = columns.Performance_Reports.filter(column => column.name !== 'ContentJSON');
  columns.Report_Schedules = columns.Report_Schedules.map(column =>
    column.name === 'BindingJSON' ? text('BindingJSON') :
      column.name === 'NextSendAt' ? dateTime('NextSendAt', false) : column);
  const inventory = await collectSchedulerTenantInventory(
    gateway(columns, { noETag: true }), 'SCPNG Scheduler UAT', 'non-production', () => '2027-02-10T01:00:00.000Z',
  );
  const manifest = assessSchedulerTenantReadiness(inventory, attestations(), () => '2027-02-10T02:00:00.000Z');
  assert.equal(manifest.schemaReadyForAdapterImplementation, false);
  assert.equal(manifest.activationReady, false);
  assert.equal(manifest.deploymentContract, undefined);
  assert.deepEqual(
    new Set(manifest.findings.map(finding => finding.code)),
    new Set(['column-missing', 'column-kind-mismatch', 'column-not-indexed', 'schedule-etag-unverified']),
  );
});

test('fresh complete non-production evidence produces the exact executor deployment contract', async () => {
  const inventory = await collectSchedulerTenantInventory(
    gateway(), 'SCPNG Scheduler UAT', 'non-production', () => '2027-02-10T01:00:00.000Z',
  );
  const manifest = assessSchedulerTenantReadiness(inventory, attestations(), () => '2027-02-10T02:00:00.000Z');
  assert.equal(manifest.schemaReadyForAdapterImplementation, true);
  assert.equal(manifest.activationReady, true);
  assert.deepEqual(manifest.findings, []);
  assert.deepEqual(manifest.deploymentContract, {
    contractVersion: 1,
    archiveTemplateId: 'strategy-report-archive-v1',
    deliveryTemplateId: 'strategy-report-delivery-v1',
    executorId: 'strategy-report-scheduled-delivery-v1',
    scheduleSnapshotFieldsVerified: true,
    dispatchReadsArchiveByIdAndChecksum: true,
    deliveryJournalWritesVerified: true,
    scheduleLeaseAndCheckpointWritesVerified: true,
    idempotentEmailSendVerified: true,
  });
  assert.equal(Object.isFrozen(manifest.deploymentContract), true);
});

test('stale attestations and production inventory cannot authorize activation', async () => {
  const production = await collectSchedulerTenantInventory(
    gateway(), 'SCPNG Production', 'production', () => '2027-02-10T01:00:00.000Z',
  );
  const manifest = assessSchedulerTenantReadiness(
    production,
    attestations({ verifiedAt: '2026-12-01T00:00:00.000Z' }),
    () => '2027-02-10T02:00:00.000Z',
  );
  assert.equal(manifest.activationReady, false);
  assert.equal(manifest.findings.some(finding => finding.code === 'capability-attestations-stale'), true);
  assert.equal(manifest.findings.some(finding => finding.code === 'production-activation-not-approved'), true);
});

test('inspection failures remain visible and never become an empty ready manifest', async () => {
  const inventory = await collectSchedulerTenantInventory(
    gateway(completeColumns(), { failList: 'Performance_Reports' }),
    'SCPNG Scheduler UAT', 'non-production', () => '2027-02-10T01:00:00.000Z',
  );
  const manifest = assessSchedulerTenantReadiness(inventory, attestations(), () => '2027-02-10T02:00:00.000Z');
  assert.equal(manifest.activationReady, false);
  assert.equal(manifest.findings.some(finding => finding.code === 'list-inspection-failed'), true);
  assert.match(manifest.findings.find(finding => finding.code === 'list-inspection-failed').message, /access denied/);
});
