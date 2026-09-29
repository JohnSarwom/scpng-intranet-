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
  buildLinkageInventory,
  canViewLinkageInventory,
  linkageIssuesToCsv,
  tracedTaskShare,
  NO_UNIT_LABEL,
} = load('../services/linkageInventoryService.ts');

const objectives = [
  { id: '1', title: 'Org goal', goalType: 'Org', division: '', unit: '' },
  { id: '10', title: 'IT objective', goalType: 'Unit', division: 'Corporate Services Division', unit: 'IT Unit', linkedDeliverable: 'Goal 1' },
  { id: '11', title: 'Orphan objective', goalType: 'Unit', division: 'Corporate Services', unit: 'HR Unit' },
  { id: '12', title: 'Legal objective', goalType: 'Unit', division: 'Legal Division', unit: 'Legal Unit', parentGoalId: 3 },
];
const kras = [
  { id: '100', title: 'Traced KRA', division: 'Corporate Services Division', unit: 'IT Unit', objective_id: '10' },
  { id: '101', title: 'KRA without objective', division: 'Corporate Services Division', unit: 'HR Unit', objective_id: '' },
  { id: '102', title: 'KRA with deleted objective', division: 'Corporate Services Division', unit: 'IT Unit', objective_id: '999' },
  { id: '103', title: 'Legal KRA', division: 'Legal Division', unit: 'Legal Unit', objective_id: '12' },
  { id: '104', title: 'KRA with unit only', division: '', unit: 'hr unit', objective_id: '10' },
];
const kpis = [
  { id: '200', name: 'Traced KPI', kra_id: '100' },
  { id: '201', name: 'KPI under KRA without objective', kra_id: '101' },
  { id: '202', name: 'KPI with no KRA', kra_id: '' },
  { id: '203', name: 'KPI with deleted KRA', kra_id: '888' },
  { id: '204', name: 'Legal KPI', kra_id: '103' },
];
const tasks = [
  { id: 't1', title: 'Traced task', unit_id: 'IT Unit', kpi_id: '200', kra_id: '100' },
  { id: 't2', title: 'Unlinked task', unit_id: 'IT Unit' },
  { id: 't3', title: 'KRA-only task', unit_id: 'HR Unit', kra_id: '101' },
  { id: 't4', title: 'Task with deleted KPI', unit_id: 'HR Unit', kpi_id: '777' },
  { id: 't5', title: 'Incomplete chain task', unit_id: 'HR Unit', kpi_id: '201' },
  { id: 't6', title: 'Conflicting KRA task', unit_id: 'IT Unit', kpi_id: '200', kra_id: '102' },
  { id: 't7', title: 'Legal task', unit_id: 'Legal Unit', kpi_id: '204' },
  { id: 't8', title: 'No unit, linked into division', unit_id: '', kpi_id: '200' },
  { id: 't9', title: 'No unit, unlinked', unit_id: '' },
  { id: 't10', title: 'Task with deleted KRA', unit_id: 'it unit', kra_id: '555' },
];

function build() {
  return buildLinkageInventory({
    divisionName: 'Corporate Services Division',
    unitNames: ['IT Unit', 'HR Unit', 'Finance Unit'],
    tasks, kpis, kras, objectives,
    generatedAt: '2026-09-29T00:00:00.000Z',
  });
}

const unitOf = (inventory, name) => inventory.units.find(u => u.unit === name);

test('tasks are classified into exactly one linkage state per unit', () => {
  const inventory = build();
  const it = unitOf(inventory, 'IT Unit');
  assert.deepEqual({ ...it.tasks }, {
    total: 4, traced: 2, chainIncomplete: 0, kraOnly: 0, brokenLink: 1, unlinked: 1, kraConflict: 1,
  });
  const hr = unitOf(inventory, 'HR Unit');
  assert.deepEqual({ ...hr.tasks }, {
    total: 3, traced: 0, chainIncomplete: 1, kraOnly: 1, brokenLink: 1, unlinked: 0, kraConflict: 0,
  });
  const t = inventory.totals.tasks;
  assert.equal(t.traced + t.chainIncomplete + t.kraOnly + t.brokenLink + t.unlinked, t.total);
});

test('tasks with no unit are placed only through a KRA in this division', () => {
  const inventory = build();
  const noUnit = unitOf(inventory, NO_UNIT_LABEL);
  assert.equal(noUnit.tasks.total, 1);
  assert.equal(noUnit.tasks.traced, 1);
  assert.ok(!inventory.issues.some(i => i.recordId === 't9'), 'unlinked task without a unit cannot be placed');
  assert.equal(noUnit, inventory.units[inventory.units.length - 1], 'no-unit row sorts last');
});

test('other divisions are excluded, and every rostered unit gets a row', () => {
  const inventory = build();
  assert.ok(!inventory.issues.some(i => ['t7', '103', '204', '12'].includes(i.recordId)));
  assert.equal(unitOf(inventory, 'Legal Unit'), undefined);
  const finance = unitOf(inventory, 'Finance Unit');
  assert.equal(finance.tasks.total, 0);
  assert.equal(tracedTaskShare(finance), null);
  assert.equal(tracedTaskShare(unitOf(inventory, 'IT Unit')), 50);
});

test('KRAs resolve objectives by id and fall back to unit when division is blank', () => {
  const inventory = build();
  assert.deepEqual({ ...unitOf(inventory, 'IT Unit').kras }, { total: 2, traced: 1, noObjective: 0, brokenObjective: 1, noKpis: 1 });
  assert.deepEqual({ ...unitOf(inventory, 'HR Unit').kras }, { total: 2, traced: 1, noObjective: 1, brokenObjective: 0, noKpis: 1 });
});

test('KPIs without a resolvable KRA are reported organisation-wide, not per unit', () => {
  const inventory = build();
  assert.deepEqual(inventory.unplacedKpis.map(k => [k.recordId, k.code]), [['202', 'kpi_no_kra'], ['203', 'kpi_broken_kra']]);
  assert.deepEqual({ ...unitOf(inventory, 'IT Unit').kpis }, { total: 1, traced: 1, noTasks: 0 });
  assert.deepEqual({ ...unitOf(inventory, 'HR Unit').kpis }, { total: 1, traced: 0, noTasks: 0 });
});

test('org-level objectives are skipped and unit objectives need a strategic parent', () => {
  const inventory = build();
  assert.deepEqual({ ...unitOf(inventory, 'IT Unit').objectives }, { total: 1, noParent: 0 });
  assert.deepEqual({ ...unitOf(inventory, 'HR Unit').objectives }, { total: 1, noParent: 1 });
  assert.equal(inventory.totals.objectives.total, 2);
});

test('the inventory does not mutate its input records', () => {
  const snapshot = JSON.stringify({ tasks, kpis, kras, objectives });
  build();
  assert.equal(JSON.stringify({ tasks, kpis, kras, objectives }), snapshot);
});

test('read access is admin-wide and division-exact for managers and directors', () => {
  const manager = { role_name: 'Manager', is_admin: false, division_name: 'Corporate Services Division' };
  assert.equal(canViewLinkageInventory(manager, 'corporate services'), true);
  assert.equal(canViewLinkageInventory({ ...manager, role_name: 'director' }, 'Corporate Services Division'), true);
  assert.equal(canViewLinkageInventory({ ...manager, division_name: 'Legal Division' }, 'Corporate Services Division'), false);
  assert.equal(canViewLinkageInventory({ ...manager, role_name: 'staff_member' }, 'Corporate Services Division'), false);
  assert.equal(canViewLinkageInventory({ role_name: 'staff', is_admin: true, division_name: '' }, 'Legal Division'), true);
  assert.equal(canViewLinkageInventory(null, 'Legal Division'), false);
  assert.equal(canViewLinkageInventory(manager, ''), false);
});

test('CSV export quotes values and neutralises formula injection', () => {
  const inventory = buildLinkageInventory({
    divisionName: 'Corporate Services Division',
    unitNames: ['IT Unit'],
    tasks: [{ id: 't1', title: '=HYPERLINK("x"), "quoted"', unit_id: 'IT Unit' }],
    kpis: [], kras: [], objectives: [],
  });
  const lines = linkageIssuesToCsv(inventory).split('\r\n');
  assert.equal(lines[0], 'Division,Unit,Record type,Record ID,Title,Severity,Issue');
  assert.equal(lines[1], `Corporate Services Division,IT Unit,task,t1,"'=HYPERLINK(""x""), ""quoted""",gap,Task is not linked to any KPI or KRA.`);
});
