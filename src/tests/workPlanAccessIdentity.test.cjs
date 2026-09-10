const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function compile(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}
function load(file) {
  const exports = {};
  vm.runInThisContext(`(function(exports) { ${compile(fs.readFileSync(path.resolve(__dirname, file), 'utf8'))} })`)(exports);
  return exports;
}
const access = load('../utils/workPlanAccess.ts');
const identity = load('../utils/workPlanIdentity.ts');
const editor = load('../utils/workPlanEditor.ts');
const manager = { user_email: 'manager@example.test', role_name: 'manager', division_name: 'Licensing', is_admin: false };
const plan = () => ({ id: '1', divisionName: 'Licensing', goals: [{ id: 'goal1', title: 'Plan goal', activities: [], organizationalGoalRef: { list: 'Strategic_Objectives', id: '42' } }] });

test('manager edits own division; administrators edit across divisions; readers and missing roles fail closed', () => {
  assert.equal(access.canManageWorkPlan(manager, ' licensing '), true);
  assert.equal(access.canManageWorkPlan(manager, 'Corporate Services'), false);
  assert.equal(access.canManageWorkPlan(manager, ''), false);
  assert.equal(access.canManageWorkPlan({ ...manager, role_name: 'staff' }, 'Licensing'), false);
  assert.equal(access.canManageWorkPlan(null, 'Licensing'), false);
  assert.equal(access.canManageWorkPlan({ ...manager, is_admin: true }, 'Corporate Services'), true);
});

test('an organizational dropdown ID never becomes an execution objective ID', () => {
  const row = { id: 'new-1', activity: 'Activity', strategicObjective: 'Goal', linkedObjectiveId: '42',
    organizationalGoalRef: { list: 'Strategic_Objectives', id: '42' }, output: '', kpi: '', responsibleOfficer: '',
    timelineStart: '', timelineEnd: '', resources: '', status: 'not-started' };
  const goal = editor.rowsToGoals([row], '1')[0];
  assert.equal(goal.linkedObjectiveId, undefined);
  assert.deepEqual(goal.organizationalGoalRef, { list: 'Strategic_Objectives', id: '42' });
});

test('ambiguous legacy execution IDs fail before cascade writes; explicit matching refs pass', () => {
  const value = plan();
  value.goals[0].linkedObjectiveId = '42';
  assert.throws(() => identity.assertWorkPlanExecutionIdentity(value), /unverified legacy/);
  value.goals[0].executionObjectiveRef = { list: 'Unit_Objectives', id: '42' };
  assert.doesNotThrow(() => identity.assertWorkPlanExecutionIdentity(value));
  value.goals[0].executionObjectiveRef.id = '43';
  assert.throws(() => identity.assertWorkPlanExecutionIdentity(value), /inconsistent/);
});

test('corporate IDs, unmapped new goals and source plans cannot enter the old activation engine', () => {
  const value = plan();
  value.goals[0].organizationalGoalRef.list = 'Strategic_Goals';
  assert.throws(() => identity.assertWorkPlanExecutionIdentity(value), /crosswalk/);
  delete value.goals[0].organizationalGoalRef;
  assert.throws(() => identity.assertWorkPlanExecutionIdentity(value), /explicit organizational parent/);
  value.goals[0].organizationalGoalRef = { list: 'Strategic_Objectives', id: '42' };
  value.goals[0].kras = [{ id: 'sg3.1' }];
  assert.throws(() => identity.assertWorkPlanExecutionIdentity(value), /source-aware activation/);
});

function serviceHarness(role = manager, fields = {}) {
  const filename = path.resolve(__dirname, '../services/sharePointOpsService.ts');
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  const klass = ast.statements.find(s => ts.isClassDeclaration(s) && s.name.text === 'SharePointOpsService');
  const names = ['assertWorkPlanWriteAccess', 'validateWorkPlanExecutionLinks', 'addWorkPlan', 'updateWorkPlan', 'deleteWorkPlan', 'activateWorkPlan', 'syncWorkPlanToSharePoint'];
  const methods = klass.members.filter(m => m.name && names.includes(m.name.getText(ast)));
  const factory = vm.runInThisContext(`(function(UserSharePointService, assertCanManageWorkPlan, assertWorkPlanExecutionIdentity) {
    ${compile(`class Harness { ${methods.map(m => m.getText(ast)).join('\n')} }; return new Harness();`)}
  })`);
  const calls = [];
  const service = factory(class { async getUser() { calls.push('getUser'); return role; } }, access.assertCanManageWorkPlan, identity.assertWorkPlanExecutionIdentity);
  service.siteId = 'site';
  service.listIds = { WORKPLANS: 'plans', OBJECTIVES: 'objectives', KRAS: 'kras', KPIS: 'kpis' };
  service.client = { api(url) {
    calls.push(url);
    return { select() { return this; }, expand() { return this; }, async get() {
      return url === '/me' ? { mail: 'manager@example.test' } : { fields: fields[url] || { DivisionName: 'Licensing' } };
    }, async post() { calls.push('WRITE'); }, async patch() { calls.push('WRITE'); }, async delete() { calls.push('WRITE'); } };
  } };
  return { service, calls };
}

test('all five work-plan service mutations deny a reader before writes, independently of UI', async () => {
  for (const operation of ['addWorkPlan', 'updateWorkPlan', 'deleteWorkPlan', 'activateWorkPlan', 'syncWorkPlanToSharePoint']) {
    const { service, calls } = serviceHarness({ ...manager, role_name: 'staff' });
    const args = operation === 'updateWorkPlan' ? ['1', plan()] : operation === 'deleteWorkPlan' ? ['1'] : [plan()];
    await assert.rejects(service[operation](...args), /permission/);
    assert.equal(calls.includes('WRITE'), false);
    assert.ok(calls.includes('/me'));
    assert.ok(calls.includes('getUser'));
  }
});

test('an authorized manager cannot move a different division’s plan into their own division', async () => {
  const { service, calls } = serviceHarness(manager, { '/sites/site/lists/plans/items/1': { DivisionName: 'Corporate Services' } });
  await assert.rejects(service.updateWorkPlan('1', plan()), /permission/);
  assert.equal(calls.includes('WRITE'), false);
});

test('unavailable authoritative role lookup fails closed', async () => {
  const { service, calls } = serviceHarness(null);
  await assert.rejects(service.deleteWorkPlan('1'), /permission/);
  assert.equal(calls.includes('WRITE'), false);
});

test('execution preflight rejects an objective from another division', async () => {
  const value = plan();
  Object.assign(value.goals[0], { linkedObjectiveId: '42', executionObjectiveRef: { list: 'Unit_Objectives', id: '42' } });
  const { service, calls } = serviceHarness(manager, { '/sites/site/lists/objectives/items/42': { Division: 'Corporate Services' } });
  await assert.rejects(service.validateWorkPlanExecutionLinks(value), /does not belong/);
  assert.equal(calls.includes('WRITE'), false);
});

test('execution preflight rejects KRA and KPI links outside the selected chain', async () => {
  const value = plan();
  Object.assign(value.goals[0], { linkedObjectiveId: '42', executionObjectiveRef: { list: 'Unit_Objectives', id: '42' }, activities: [{ title: 'Act', linkedKraId: '12', linkedKpiId: '13' }] });
  const fields = { '/sites/site/lists/objectives/items/42': { Division: 'Licensing' }, '/sites/site/lists/kras/items/12': { UnitObjectiveLookupId: '99' } };
  const { service } = serviceHarness(manager, fields);
  await assert.rejects(service.validateWorkPlanExecutionLinks(value), /KRA.*does not belong/);
  fields['/sites/site/lists/kras/items/12'] = { UnitObjectiveLookupId: '42' };
  fields['/sites/site/lists/kpis/items/13'] = { RelatedKRALookupId: '99' };
  await assert.rejects(service.validateWorkPlanExecutionLinks(value), /KPI.*does not belong/);
  fields['/sites/site/lists/kpis/items/13'] = { RelatedKRALookupId: '12' };
  await assert.doesNotReject(service.validateWorkPlanExecutionLinks(value));
});

test('read-only work-plan hook queries never migrate data and all mutation callbacks deny writes', async () => {
  const filename = path.resolve(__dirname, '../hooks/useWorkPlans.ts');
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(s => ts.isFunctionDeclaration(s) && s.name.text === 'useWorkPlans');
  const factory = vm.runInThisContext(`(function(exports, useOpsService, useRoleBasedAuth, assertCanManageWorkPlan, useQueryClient, useToast, useQuery) { ${compile(fn.getText(ast))} })`);
  const exports = {};
  let query;
  let serviceRequests = 0;
  factory(exports, () => async () => { serviceRequests++; return { getWorkPlans: async () => [] }; },
    () => ({ user: { ...manager, role_name: 'staff' }, loading: false }), access.assertCanManageWorkPlan,
    () => ({}), () => ({ toast: () => { throw Error('Unexpected mutation notification'); } }),
    options => { query = options; return { data: [], isLoading: false }; });
  const hook = exports.useWorkPlans('division1', 'Licensing');
  assert.deepEqual(await query.queryFn(), []);
  assert.equal(serviceRequests, 1);
  for (const operation of ['addWorkPlan', 'updateWorkPlan', 'deleteWorkPlan', 'activateWorkPlan', 'syncWorkPlan']) {
    const args = operation === 'updateWorkPlan' ? ['1', plan()] : operation === 'deleteWorkPlan' ? ['1'] : [plan()];
    await assert.rejects(hook[operation](...args), /permission/);
  }
  assert.equal(serviceRequests, 1);
});

test('KRA selector distinguishes duplicate titles and clears selection when a new title is typed', () => {
  const filename = path.resolve(__dirname, '../components/kpi/KraFormSection.tsx');
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const callbacks = [];
  function visit(node) {
    if (ts.isJsxAttribute(node) && ['onValueChange', 'onSelect'].includes(node.name.getText(ast)) && node.initializer?.expression) callbacks.push(node.initializer.expression.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const pick = callbacks.find(text => text.includes('const originalTitle = kra.title.trim()'));
  const type = callbacks.find(text => text.includes('setInputValue(search)'));
  assert.ok(pick && type);
  const formData = { id: '1', title: 'Same title' };
  const onChange = (field, value) => { formData[field] = value; };
  const factory = source => vm.runInThisContext(`(function(formData, kra, onChange, setInputValue, isAddingNew) { ${compile(`return (${source});`)} })`);
  factory(pick)(formData, { id: '2', title: 'Same title' }, onChange, () => {}, true)();
  assert.equal(formData.id, '2');
  assert.equal(formData.title, 'Same title');
  factory(type)(formData, {}, onChange, () => {}, true)('A new title');
  assert.equal(formData.id, undefined);
  assert.equal(formData.title, 'A new title');
});

test('draft saves cannot drop execution links or overwrite an interrupted activation', async () => {
  const filename = path.resolve(__dirname, '../services/sharePointOpsService.ts');
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  const klass = ast.statements.find(s => ts.isClassDeclaration(s) && s.name.text === 'SharePointOpsService');
  const method = klass.members.find(m => m.name?.getText(ast) === 'assertWorkPlanEditable');
  const factory = vm.runInThisContext(`(function(WorkPlanStorageService) { ${compile(`class Harness { ${method.getText(ast)} }; return new Harness();`)} })`);
  const service = factory(class { async decode(raw) { return JSON.parse(raw); } });
  const goals = [{ id: 'g', linkedObjectiveId: '42', activities: [{ id: 'a', linkedKraId: '1', linkedKpiId: '2', linkedTaskIds: ['3'] }] }];
  const existing = { eTag: 'v1', fields: { GoalsJSON: JSON.stringify(goals) } };
  const changed = structuredClone(goals); changed[0].activities[0].linkedTaskIds = [];
  await assert.rejects(service.assertWorkPlanEditable(existing, { goals: changed }), /reconciliation review/);
  await assert.rejects(service.assertWorkPlanEditable(existing, { revision: 'v0' }), /changed since/);
  existing.fields.ActivationJSON = JSON.stringify({ state: 'failed' });
  await assert.rejects(service.assertWorkPlanEditable(existing, {}), /Recover the interrupted/);
});

test('KPI mapper and update round-trip corporate links and specialized measurement evidence', async () => {
  const filename = path.resolve(__dirname, '../services/sharePointOpsService.ts');
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  const klass = ast.statements.find(s => ts.isClassDeclaration(s) && s.name.text === 'SharePointOpsService');
  const methods = klass.members.filter(m => ['mapKPI', 'updateKPI', 'requireCurrentRevision', 'isStaleWriteError', 'patchWithRevision'].includes(m.name?.getText(ast)));
  const normalize = value => value == null || value === '' ? null : String(value);
  const factory = vm.runInThisContext(`(function(normalizeLookupString, normalizeLookupNumber) { ${compile(`class Harness { ${methods.map(m => m.getText(ast)).join('\n')} }; return new Harness();`)} })`);
  const service = factory(normalize, value => normalize(value) === null ? null : Number(value));
  const item = { id: '1', eTag: 'v1', fields: {
    Title: 'KPI', RelatedInitiativeLookupId: 7,
    MeasurementDefinitionJSON: JSON.stringify({ mode: 'service-level', rawTarget: 'At least 95%', target: 95 }),
    MeasurementEvidenceJSON: JSON.stringify({ eligibleCount: 100, compliantCount: 94, asOf: '2027-03-31' }),
  } };
  service.siteId = 'site'; service.listIds = { KPIS: 'kpis' };
  service.client = { api() { return { expand() { return this; }, header() { return this; }, async patch(body) { Object.assign(item.fields, body.fields); item.eTag = item.eTag === 'v1' ? 'v2' : 'v3'; return {}; }, async get() { return structuredClone(item); } }; } };
  assert.equal(service.mapKPI(item).initiative_id, '7');
  assert.equal(service.mapKPI(item).measurementDefinition.mode, 'service-level');
  assert.equal(service.mapKPI(item).measurementEvidence.compliantCount, 94);
  assert.equal((await service.updateKPI('1', { initiative_id: '8' })).initiative_id, '8');
  const evidence = { eligibleCount: 120, compliantCount: 118, asOf: '2027-06-30' };
  assert.deepEqual((await service.updateKPI('1', { measurementEvidence: evidence })).measurementEvidence, evidence);
  assert.equal((await service.updateKPI('1', { initiative_id: null })).initiative_id, null);
});

test('a new plan records its persisted URL before activation and retries reuse the same draft', async () => {
  const filename = path.resolve(__dirname, '../pages/WorkPlanBuilderPage.tsx');
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleSave') handler = node.initializer.getText(ast); ts.forEachChild(node, visit); }
  visit(ast); assert.ok(handler);
  const routes = []; let creates = 0, attempts = 0;
  const context = {
    divisionData: { canEditStrategy: true }, saving: false, plansLoading: false, isNew: true, existingPlan: undefined,
    setSaving() {}, setSaveError() {}, savedDraft: null, setSavedDraft(value) { context.savedDraft = value; },
    async addWorkPlan(value) { creates++; return { ...value, id: '123', revision: 'v1' }; },
    async activateWorkPlan(value) { assert.equal(value.id, '123'); assert.ok(routes[0].endsWith('/123/edit')); if (++attempts === 1) throw Error('Injected activation failure'); },
    async updateWorkPlan() { throw Error('Unexpected draft rewrite'); }, async syncWorkPlan() {},
    navigate(route) { routes.push(route); }, divisionId: 'division1', resolvedDivisionId: 'division1', console: { error() {} },
  };
  const run = () => vm.runInThisContext(`(function(${Object.keys(context).join(',')}) { ${compile(`return (${handler});`)} })`)(...Object.values(context));
  await run()({ ...plan(), status: 'active' }); await run()({ ...plan(), status: 'active' });
  assert.equal(creates, 1); assert.equal(attempts, 2);
});
