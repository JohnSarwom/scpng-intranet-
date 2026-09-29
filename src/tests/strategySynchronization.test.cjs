const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const servicePath = path.resolve(__dirname, '../services/sharePointOpsService.ts');
const source = fs.readFileSync(servicePath, 'utf8');
const sourceFile = ts.createSourceFile(servicePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const serviceClass = sourceFile.statements.find(
  node => ts.isClassDeclaration(node) && node.name?.text === 'SharePointOpsService'
);
assert.ok(serviceClass, 'SharePointOpsService class must exist');

const strategyServicePath = path.resolve(__dirname, '../services/strategyService.ts');
const strategySource = fs.readFileSync(strategyServicePath, 'utf8');
const strategySourceFile = ts.createSourceFile(
  strategyServicePath, strategySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS
);
const strategyClass = strategySourceFile.statements.find(
  node => ts.isClassDeclaration(node) && node.name?.text === 'StrategyService'
);
assert.ok(strategyClass, 'StrategyService class must exist');

function methodSource(name) {
  const method = serviceClass.members.find(
    node => ts.isMethodDeclaration(node) && node.name?.getText(sourceFile) === name
  );
  assert.ok(method, `Expected SharePointOpsService.${name}`);
  return method.getText(sourceFile);
}

function harness(methodNames, extraMembers = '') {
  const concurrencyMethods = ['requireCurrentRevision', 'isStaleWriteError', 'patchWithRevision', 'deleteWithRevision'];
  const includedMethods = [...new Set([...concurrencyMethods, ...methodNames])];
  const classSource = `
    const normalizeLookupString = value => {
      if (value === undefined || value === null) return null;
      const normalized = String(value).trim();
      return !normalized || ['none', 'null', 'undefined', 'nan'].includes(normalized.toLowerCase())
        ? null
        : normalized;
    };
    const normalizeLookupNumber = value => {
      const normalized = normalizeLookupString(value);
      return normalized === null ? null : Number(normalized);
    };
    class Harness {
      client;
      siteId = 'site';
      listIds = { KPIS: 'kpis', TASKS: 'tasks', KRAS: 'kras', OBJECTIVES: 'objectives' };
      constructor(client) { this.client = client; }
      async initialize() {}
      ${includedMethods.map(methodSource).join('\n')}
      ${extraMembers}
    }
    module.exports = Harness;
  `;
  const output = ts.transpileModule(classSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(module, exports) { ${output}\n})`, { filename: servicePath })(module, module.exports);
  return module.exports;
}

function strategyMethodSource(name) {
  const method = strategyClass.members.find(
    node => ts.isMethodDeclaration(node) && node.name?.getText(strategySourceFile) === name
  );
  assert.ok(method, `Expected StrategyService.${name}`);
  return method.getText(strategySourceFile);
}

function strategyHarness(methodNames) {
  const classSource = `
    class Harness {
      client;
      siteId = 'site';
      listIds = { OBJECTIVES: 'objectives' };
      constructor(client) { this.client = client; }
      ${methodNames.map(strategyMethodSource).join('\n')}
    }
    module.exports = Harness;
  `;
  const output = ts.transpileModule(classSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(module, exports) { ${output}\n})`, { filename: strategyServicePath })(module, module.exports);
  return module.exports;
}

function graphFixture({ pages = {}, items = {}, patchFailures = {} } = {}) {
  const writes = [];
  const creates = [];
  const reads = [];
  const deletes = [];
  const client = {
    api(rawUrl) {
      let url = rawUrl;
      const headers = {};
      const request = {
        expand() { return this; },
        filter() { return this; },
        select() { return this; },
        top() { return this; },
        orderby() { return this; },
        header(name, value) { headers[name] = value; return this; },
        async get() {
          reads.push(url);
          if (Object.hasOwn(pages, url)) return structuredClone(pages[url]);
          if (Object.hasOwn(items, url)) return structuredClone({ eTag: 'v1', ...items[url] });
          throw new Error(`Unexpected GET ${url}`);
        },
        async patch(body) {
          const injectedFailure = patchFailures[url]?.shift?.();
          if (injectedFailure) {
            if (injectedFailure.nextETag && items[url]) items[url].eTag = injectedFailure.nextETag;
            throw injectedFailure.error || injectedFailure;
          }
          writes.push({ url, body: structuredClone(body), headers: structuredClone(headers) });
          if (items[url]?.fields && body.fields) {
            Object.assign(items[url].fields, structuredClone(body.fields));
            items[url].eTag = 'v2';
          }
          return {};
        },
        async post(body) {
          creates.push({ url, body: structuredClone(body) });
          return { id: '99', fields: structuredClone(body.fields || {}) };
        },
        async delete() { deletes.push({ url, headers: structuredClone(headers) }); }
      };
      return request;
    }
  };
  return { client, writes, creates, reads, deletes };
}

const kpiUrl = id => `/sites/site/lists/kpis/items/${id}`;
const taskCollectionUrl = '/sites/site/lists/tasks/items';
const kpiCollectionUrl = '/sites/site/lists/kpis/items';
const kraUrl = id => `/sites/site/lists/kras/items/${id}`;
const kraCollectionUrl = '/sites/site/lists/kras/items';
const objectiveUrl = id => `/sites/site/lists/objectives/items/${id}`;

test('manual KPI task association preserves its mode, measurements and status', async () => {
  const KPIHarness = harness(
    ['getPagedValues', 'syncKPIChecklistFromTasks'],
    'kraSyncs = []; async syncKRAProgress(id) { this.kraSyncs.push(id); }'
  );
  const fields = {
    CalculationType: 'manual', TargetValue: 100, ActualValue: 41,
    Status: 'On Track', RelatedKRALookupId: 7
  };
  const g = graphFixture({ items: { [kpiUrl('3')]: { id: '3', fields } } });
  const service = new KPIHarness(g.client);

  await service.syncKPIChecklistFromTasks('3', { id: '99', status: 'Completed', linked: true });

  assert.deepEqual(g.writes, []);
  assert.equal(fields.CalculationType, 'manual');
  assert.equal(fields.ActualValue, 41);
  assert.equal(fields.Status, 'On Track');
  assert.deepEqual(service.kraSyncs, ['7']);
});

test('Task creation derives its direct KRA link from the selected KPI and rejects conflicts', async () => {
  const TaskHarness = harness(
    ['getRequiredKpiKraId', 'addTask'],
    `
      kpiSyncs = [];
      mapStatusForSharePoint(value) { return value || 'Todo'; }
      mapPriorityForSharePoint(value) { return value || 'Medium'; }
      updateTagsWithBucketId(tags) { return tags; }
      mapTask(item) { return item; }
      async syncKPIChecklistFromTasks(id, recent) { this.kpiSyncs.push({ id, recent }); }
    `
  );
  const g = graphFixture({
    items: { [kpiUrl('3')]: { id: '3', fields: { RelatedKRALookupId: 7 } } }
  });
  const service = new TaskHarness(g.client);

  await service.addTask({ title: 'Evidence Task', kpi_id: '3' });

  assert.equal(g.creates[0].body.fields.RelatedKPILookupId, 3);
  assert.equal(g.creates[0].body.fields.RelatedKRALookupId, 7);
  assert.deepEqual(service.kpiSyncs[0], {
    id: '3',
    recent: { id: '99', status: 'Todo', title: 'Evidence Task', linked: true }
  });

  await assert.rejects(
    service.addTask({ title: 'Conflict', kpi_id: '3', kra_id: '8' }),
    /conflicts with KPI 3/
  );
  assert.equal(g.creates.length, 1);
});

test('Task movement and unlink synchronize old/new KPIs and keep both ancestry links coherent', async () => {
  const TaskHarness = harness(
    ['getRequiredKpiKraId', 'updateTask'],
    `
      kpiSyncs = [];
      mapStatusForSharePoint(value) { return value || 'Todo'; }
      mapPriorityForSharePoint(value) { return value || 'Medium'; }
      updateTagsWithBucketId(tags) { return tags; }
      mapTask(item) { return item; }
      async syncKPIChecklistFromTasks(id, recent) { this.kpiSyncs.push({ id, recent }); }
    `
  );
  const taskUrl = '/sites/site/lists/tasks/items/9';
  const g = graphFixture({
    items: {
      [taskUrl]: { id: '9', fields: { Title: 'Original', Status: 'Todo', RelatedKPILookupId: 3, RelatedKRALookupId: 7 } },
      [kpiUrl('4')]: { id: '4', fields: { RelatedKRALookupId: 8 } }
    }
  });
  const service = new TaskHarness(g.client);

  await service.updateTask('9', { title: 'Moved', kpi_id: '4' });

  assert.equal(g.writes[0].body.fields.RelatedKPILookupId, 4);
  assert.equal(g.writes[0].body.fields.RelatedKRALookupId, 8);
  assert.equal(g.writes[0].headers['If-Match'], 'v1');
  assert.deepEqual(service.kpiSyncs.map(call => [call.id, call.recent.linked]), [['3', false], ['4', true]]);

  service.kpiSyncs.length = 0;
  await service.updateTask('9', { kpi_id: 'none', kra_id: 'none' });
  assert.equal(g.writes[1].body.fields.RelatedKPILookupId, null);
  assert.equal(g.writes[1].body.fields.RelatedKRALookupId, null);
  assert.equal(g.writes[1].headers['If-Match'], 'v2');
  assert.deepEqual(service.kpiSyncs.map(call => [call.id, call.recent.linked]), [['4', false]]);
});

test('checklist reconciliation follows every Task page and retains later-page Tasks', async () => {
  const KPIHarness = harness(
    ['getPagedValues', 'syncKPIChecklistFromTasks'],
    'async syncKRAProgress() {}'
  );
  const fields = {
    CalculationType: 'checklist', RelatedKRALookupId: 7,
    ChecklistJSON: JSON.stringify([{ id: 'manual-1', text: 'Evidence reviewed', checked: true }])
  };
  const g = graphFixture({
    items: { [kpiUrl('3')]: { id: '3', fields } },
    pages: {
      [taskCollectionUrl]: {
        value: [{ id: '1', fields: { Title: 'First', Status: 'Completed', RelatedKPILookupId: 3 } }],
        '@odata.nextLink': '/tasks-page-2'
      },
      '/tasks-page-2': {
        value: [{ id: '2', fields: { Title: 'Second', Status: 'Todo', RelatedKPILookupId: 3 } }]
      }
    }
  });
  const service = new KPIHarness(g.client);

  await service.syncKPIChecklistFromTasks('3');

  const update = g.writes.find(write => write.url === kpiUrl('3')).body.fields;
  const checklist = JSON.parse(update.ChecklistJSON);
  assert.deepEqual(checklist.map(item => item.id), ['manual-1', 'task-1', 'task-2']);
  assert.equal(checklist.find(item => item.taskId === '2').checked, false);
  assert.equal(update.Status, 'In Progress');
  assert.ok(g.reads.includes('/tasks-page-2'));
});

test('task-completion remains distinct and reopens when its final Task is removed', async () => {
  const KPIHarness = harness(
    ['getPagedValues', 'syncKPIChecklistFromTasks'],
    'async syncKRAProgress() {}'
  );
  const fields = { CalculationType: 'task-completion', Status: 'Completed', RelatedKRALookupId: 7 };
  const g = graphFixture({
    items: { [kpiUrl('3')]: { id: '3', fields } },
    pages: { [taskCollectionUrl]: { value: [] } }
  });
  const service = new KPIHarness(g.client);

  await service.syncKPIChecklistFromTasks('3', { id: '9', linked: false });

  assert.deepEqual(g.writes[0].body.fields, { Status: 'Not Started' });
  assert.equal(fields.CalculationType, 'task-completion');
  assert.equal(g.writes[0].body.fields.ChecklistJSON, undefined);
});

test('pagination rejects a repeated continuation instead of returning partial data', async () => {
  const PagingHarness = harness(['getPagedValues']);
  const g = graphFixture({
    pages: {
      [taskCollectionUrl]: { value: [{ id: '1' }], '@odata.nextLink': '/loop' },
      '/loop': { value: [{ id: '2' }], '@odata.nextLink': '/loop' }
    }
  });
  const service = new PagingHarness(g.client);
  await assert.rejects(
    service.getPagedValues(g.client.api(taskCollectionUrl), 'testing pagination'),
    /repeated @odata\.nextLink/
  );
});

test('KRA rollup includes later-page KPIs and reopens an empty KRA at zero', async () => {
  const KRAHarness = harness(
    ['getPagedValues', 'syncKRAProgress'],
    'objectiveSyncs = []; async syncObjectiveProgress(id) { this.objectiveSyncs.push(id); }'
  );
  const g = graphFixture({
    items: { [kraUrl('7')]: { id: '7', fields: { UnitObjectiveLookupId: 4 } } },
    pages: {
      [kpiCollectionUrl]: {
        value: [{ id: '1', fields: { RelatedKRALookupId: 7, Status: 'Open' } }],
        '@odata.nextLink': '/kpis-page-2'
      },
      '/kpis-page-2': {
        value: [{ id: '2', fields: { RelatedKRALookupId: 7, Status: 'Completed' } }]
      }
    }
  });
  const service = new KRAHarness(g.client);

  await service.syncKRAProgress('7');

  assert.deepEqual(g.writes[0].body.fields, { Progress: 50, Status: 'Open' });
  assert.ok(g.reads.includes('/kpis-page-2'));
  assert.deepEqual(service.objectiveSyncs, ['4']);

});

test('an empty KRA and Objective receive explicit zero/open states', async () => {
  const KRAHarness = harness(
    ['getPagedValues', 'syncKRAProgress'],
    'async syncObjectiveProgress() {}'
  );
  const kraGraph = graphFixture({
    items: { [kraUrl('7')]: { id: '7', fields: {} } },
    pages: { [kpiCollectionUrl]: { value: [] } }
  });
  await new KRAHarness(kraGraph.client).syncKRAProgress('7');
  assert.deepEqual(kraGraph.writes[0].body.fields, { Progress: 0, Status: 'Open' });

  const ObjectiveHarness = harness(['getPagedValues', 'syncObjectiveProgress']);
  const objectiveGraph = graphFixture({
    items: { [objectiveUrl('4')]: { id: '4', fields: {} } },
    pages: { [kraCollectionUrl]: { value: [] } }
  });
  await new ObjectiveHarness(objectiveGraph.client).syncObjectiveProgress('4');
  assert.deepEqual(objectiveGraph.writes[0], {
    url: objectiveUrl('4'),
    body: { fields: { Progress: 0, Status: 'Not Started' } },
    headers: { 'If-Match': 'v1' }
  });
});

test('derived Objective rollups recompute once after a concurrent parent write', async () => {
  const ObjectiveHarness = harness(['getPagedValues', 'syncObjectiveProgress']);
  const objectiveGraph = graphFixture({
    items: { [objectiveUrl('4')]: { id: '4', eTag: 'v1', fields: {} } },
    pages: {
      [kraCollectionUrl]: { value: [{ id: '7', fields: { UnitObjectiveLookupId: 4, Progress: 60 } }] }
    },
    patchFailures: {
      [objectiveUrl('4')]: [{ nextETag: 'v2', error: { statusCode: 412 } }]
    }
  });

  await new ObjectiveHarness(objectiveGraph.client).syncObjectiveProgress('4');

  assert.equal(objectiveGraph.reads.filter(url => url === kraCollectionUrl).length, 2);
  assert.equal(objectiveGraph.writes.length, 1);
  assert.equal(objectiveGraph.writes[0].headers['If-Match'], 'v2');
  assert.deepEqual(objectiveGraph.writes[0].body.fields, { Progress: 60, Status: 'In Progress' });
});

test('stale edits fail before writing and conditional-write races get a clear reload error', async () => {
  const TaskHarness = harness(
    ['getRequiredKpiKraId', 'updateTask'],
    `
      mapStatusForSharePoint(value) { return value || 'Todo'; }
      mapPriorityForSharePoint(value) { return value || 'Medium'; }
      updateTagsWithBucketId(tags) { return tags; }
      mapTask(item) { return item; }
      async syncKPIChecklistFromTasks() {}
    `
  );
  const taskUrl = '/sites/site/lists/tasks/items/9';
  const g = graphFixture({
    items: { [taskUrl]: { id: '9', eTag: 'v2', fields: { Title: 'Latest', Status: 'Todo' } } }
  });
  await assert.rejects(
    new TaskHarness(g.client).updateTask('9', { title: 'Stale edit', revision: 'v1' }),
    /changed after it was opened/
  );
  assert.deepEqual(g.writes, []);

  let receivedRevision;
  const VersionHarness = harness([]);
  const service = new VersionHarness({ api() { return {
    header(name, value) { if (name === 'If-Match') receivedRevision = value; return this; },
    async patch() { throw { statusCode: 412 }; }
  }; } });
  await assert.rejects(
    service.patchWithRevision(taskUrl, 'v2', { fields: { Title: 'Race' } }, 'Task 9'),
    /changed while it was being saved/
  );
  assert.equal(receivedRevision, 'v2');
});

test('Task deletes require a current version and never proceed after a stale form', async () => {
  const DeleteTaskHarness = harness(
    ['deleteTask'],
    'kpiSyncs = []; async syncKPIChecklistFromTasks(id, recent) { this.kpiSyncs.push({ id, recent }); }'
  );
  const taskUrl = '/sites/site/lists/tasks/items/9';
  const staleGraph = graphFixture({
    items: { [taskUrl]: { id: '9', eTag: 'v5', fields: { RelatedKPILookupId: 3 } } }
  });
  await assert.rejects(
    new DeleteTaskHarness(staleGraph.client).deleteTask('9', 'v4'),
    /changed after it was opened/
  );
  assert.deepEqual(staleGraph.deletes, []);

  const currentGraph = graphFixture({
    items: { [taskUrl]: { id: '9', eTag: 'v5', fields: { RelatedKPILookupId: 3 } } }
  });
  const service = new DeleteTaskHarness(currentGraph.client);
  await service.deleteTask('9', 'v5');
  assert.deepEqual(currentGraph.deletes, [{ url: taskUrl, headers: { 'If-Match': 'v5' } }]);
  assert.deepEqual(service.kpiSyncs, [{ id: '3', recent: { id: '9', linked: false } }]);
});

test('KPI delete guard finds linked Tasks on a continuation page', async () => {
  const DeleteHarness = harness(
    ['getPagedValues', 'deleteKPI'],
    'async syncKRAProgress() {}'
  );
  const g = graphFixture({
    items: { [kpiUrl('3')]: { id: '3', fields: { RelatedKRALookupId: 7 } } },
    pages: {
      [taskCollectionUrl]: { value: [], '@odata.nextLink': '/tasks-page-2' },
      '/tasks-page-2': { value: [{ id: '9', fields: { RelatedKPILookupId: 3 } }] }
    }
  });

  await assert.rejects(new DeleteHarness(g.client).deleteKPI('3'), /has 1 linked Task/);
  assert.deepEqual(g.deletes, []);
});

test('KPI reparent helper realigns direct KRA links on every Task page', async () => {
  const AlignmentHarness = harness(['getPagedValues', 'alignTaskKraLinksForKpi']);
  const g = graphFixture({
    pages: {
      [taskCollectionUrl]: {
        value: [{ id: '1', eTag: 'v1', fields: { RelatedKPILookupId: 8, RelatedKRALookupId: 2 } }],
        '@odata.nextLink': '/tasks-page-2'
      },
      '/tasks-page-2': {
        value: [{ id: '2', eTag: 'v2', fields: { RelatedKPILookupId: 8, RelatedKRALookupId: 3 } }]
      }
    }
  });

  await new AlignmentHarness(g.client).alignTaskKraLinksForKpi('8', '9');

  assert.deepEqual(g.writes.map(write => [write.url, write.body.fields.RelatedKRALookupId]), [
    ['/sites/site/lists/tasks/items/1', 9],
    ['/sites/site/lists/tasks/items/2', 9]
  ]);
});

test('report schedule consumers include schedules returned on later pages', async () => {
  const ScheduleHarness = harness(
    ['getPagedValues', 'getAllReportSchedules', 'getReportSchedule'],
    'async createReportSchedulesList() {}'
  );
  const scheduleUrl = '/sites/site/lists/schedules/items';
  const g = graphFixture({
    pages: {
      [scheduleUrl]: {
        value: [{ id: '1', fields: { UserEmail: 'first@example.test', Unit: '' } }],
        '@odata.nextLink': '/schedules-page-2'
      },
      '/schedules-page-2': {
        value: [{ id: '2', fields: { UserEmail: 'target@example.test', Unit: 'Licensing' } }]
      }
    }
  });
  const service = new ScheduleHarness(g.client);
  service.listIds.REPORT_SCHEDULES = 'schedules';

  assert.equal((await service.getAllReportSchedules()).length, 2);
  assert.equal((await service.getReportSchedule('target@example.test', 'unit')).id, '2');
  assert.equal(g.reads.filter(url => url === '/schedules-page-2').length, 2);
});

test('Strategy aggregate readers include later-page objectives and surface continuation failures', async () => {
  const StrategyHarness = strategyHarness(['getPagedValues', 'fetchObjectives']);
  const strategyObjectivesUrl = '/sites/site/lists/objectives/items';
  const g = graphFixture({
    pages: {
      [strategyObjectivesUrl]: {
        value: [{ id: '1', fields: { Title: 'First page', GoalType: 'Unit' } }],
        '@odata.nextLink': '/strategy-objectives-page-2'
      },
      '/strategy-objectives-page-2': {
        value: [{ id: '2', fields: { Title: 'Corporate result', GoalType: 'Org', Progress: 60 } }]
      }
    }
  });
  const service = new StrategyHarness(g.client);
  const objectives = await service.fetchObjectives();
  assert.deepEqual(objectives.map(item => item.id), ['2']);

  const loop = graphFixture({
    pages: {
      [strategyObjectivesUrl]: { value: [], '@odata.nextLink': '/strategy-loop' },
      '/strategy-loop': { value: [], '@odata.nextLink': '/strategy-loop' }
    }
  });
  await assert.rejects(
    new StrategyHarness(loop.client).fetchObjectives(),
    /repeated @odata\.nextLink/
  );
});

test('Strategic Objective edits use the displayed revision and reject stale forms', async () => {
  const StrategyHarness = strategyHarness(['requireCurrentRevision', 'isStaleWriteError', 'updateObjective']);
  const url = '/sites/site/lists/objectives/items/2';
  const g = graphFixture({ items: { [url]: { id: '2', eTag: 'v4', fields: { Title: 'Current' } } } });
  const service = new StrategyHarness(g.client);

  await assert.rejects(
    service.updateObjective('2', { title: 'Stale', revision: 'v3' }),
    /changed after it was opened/
  );
  assert.deepEqual(g.writes, []);

  await service.updateObjective('2', { title: 'Current edit', revision: 'v4' });
  assert.equal(g.writes[0].headers['If-Match'], 'v4');
  assert.equal(g.writes[0].body.fields.Title, 'Current edit');
});

test('strategy-execution mutations invalidate every dependent query family', async () => {
  const hookPath = path.resolve(__dirname, '../hooks/useSharePointOps.ts');
  const hookSource = fs.readFileSync(hookPath, 'utf8');
  const hookAst = ts.createSourceFile(hookPath, hookSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const prefixes = hookAst.statements.find(node =>
    ts.isVariableStatement(node) && node.declarationList.declarations.some(
      declaration => declaration.name.getText(hookAst) === 'strategyExecutionQueryPrefixes'
    )
  );
  const invalidator = hookAst.statements.find(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'invalidateStrategyExecutionQueries'
  );
  assert.ok(prefixes && invalidator);
  const module = { exports: {} };
  const output = ts.transpileModule(
    `${prefixes.getText(hookAst)}\n${invalidator.getText(hookAst)}\nmodule.exports = invalidateStrategyExecutionQueries;`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  vm.runInThisContext(`(function(module, exports) { ${output}\n})`, { filename: hookPath })(module, module.exports);
  const calls = [];
  await module.exports({ invalidateQueries({ queryKey }) { calls.push(queryKey); return Promise.resolve(); } });
  assert.deepEqual(calls, [
    ['sharePoint', 'tasks'],
    ['sharePoint', 'kpis'],
    ['sharePoint', 'kras'],
    ['sharePoint', 'objectives'],
    ['strategyData'],
  ]);
  assert.equal((hookSource.match(/await invalidateStrategyExecutionQueries\(queryClient\);/g) || []).length, 12);
});
