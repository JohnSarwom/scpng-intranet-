const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  const filename = path.resolve(__dirname, file);
  if (cache.has(filename)) return cache.get(filename);
  const exports = {}; cache.set(filename, exports);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInThisContext(`(function(exports, require) { ${code}\n})`, { filename })(exports, ref => load(path.resolve(path.dirname(filename), `${ref}.ts`)));
  return exports;
}
const { WorkPlanActivationService: Engine } = load('../services/workPlanActivationService.ts');
const { WorkPlanStorageService: Storage } = load('../services/workPlanStorageService.ts');

function planFixture() {
  return { id: '1', title: 'Annual plan', divisionId: 'division1', divisionName: 'Licensing', status: 'draft', year: 2027,
    startDate: '2027-01-01', endDate: '2027-12-31', overallProgress: 0,
    goals: [{ id: 'sg3', title: 'Licensing goal', description: 'Goal narrative', responsibleUnitNames: ['Licensing Unit'], responsibleUnitIds: ['unit1'],
      organizationalGoalRef: { list: 'Strategic_Objectives', id: '42' }, goalMeasures: [{ id: 'gm', description: 'Goal measure', target: { rawText: '≥95%' } }],
      kras: [{ id: 'sg3.1', code: 'SG3.1', title: 'Administration' }, { id: 'sg3.2', code: 'SG3.2', title: 'Monitoring' }],
      activities: [1, 2, 3].map((n) => ({ id: `activity-${n}`, goalId: 'sg3', title: `Activity ${n}`, description: 'Source activity', assignedUnitId: 'unit1', assignedUnitName: 'Licensing Unit',
        sourceKraId: n === 3 ? 'sg3.2' : 'sg3.1', kpiDescription: `Measure ${n}`, annualTarget: n === 1 ? { rawText: '12', quantity: 12, operator: 'equal', unit: 'meetings' } : { rawText: 'Continuous', serviceLevel: '≥95% within 5 working days' },
        plannedQuarters: ['Q1', 'Q2', 'Q3', 'Q4'], linkedTaskIds: [], taskPolicy: 'create-task', progress: 0, status: 'not-started', order: n })) }] };
}

function graph(plan = planFixture()) {
  const names = { plans: 'Division_WorkPlans', objectives: 'Unit_Objectives', kras: 'Performance_KRAs', kpis: 'Performance_KPIs', tasks: 'Operations_Tasks', legacy: 'Strategic_Objectives', corporate: 'Strategic_Goals', payloads: 'Division_WorkPlanPayloads' };
  const data = Object.fromEntries(Object.keys(names).map(key => [key, new Map()]));
  const columns = Object.fromEntries(Object.keys(names).map(key => [key, []]));
  const writes = [];
  const controls = { loseCreate: null, failCreate: null, race: null };
  const add = (list, id, fields) => { const item = { id: String(id), eTag: 'v1', fields: structuredClone(fields) }; data[list].set(String(id), item); return item; };
  add('plans', '1', { DivisionName: 'Licensing', DivisionId: 'division1', Status: 'draft', GoalsJSON: JSON.stringify(plan.goals) });
  add('legacy', '42', { Title: 'Organizational objective', Progress: 73 });
  add('corporate', '42', { Title: 'Different corporate goal', Progress: 61 });
  const required = { plans: ['GoalsJSON', 'Status', 'DivisionName'], objectives: ['Title', 'Description', 'Division', 'Unit', 'GoalType', 'Status', 'Progress', 'Year', 'StartDate', 'EndDate'], kras: ['Title', 'Description', 'Division', 'Unit', 'Status', 'Progress'], kpis: ['Title', 'Description', 'Metric', 'TargetValue', 'ActualValue', 'Status', 'CalculationType'], tasks: ['Title', 'Description', 'Status', 'Priority', 'Department', 'Assignees', 'StartDate', 'DueDate'] };
  for (const [list, fields] of Object.entries(required)) {
    columns[list] = fields.map(name => ({ id: name, name, ...(name === 'Status' ? { choice: { choices: ['Not Started', 'Open', 'Completed', 'Behind'] } } : { text: {} }) }));
    columns[list].push(...(list === 'plans' ? [
      { name: 'ActivationJSON', text: { allowMultipleLines: true } },
      { name: 'RetirementJSON', text: { allowMultipleLines: true } },
      { name: 'LegacyImportKey', text: {}, enforceUniqueValues: true, indexed: true },
    ] : [
      { name: 'WorkPlanOperationKey', text: {}, enforceUniqueValues: true, indexed: true },
      { name: 'WorkPlanMetadataJSON', text: { allowMultipleLines: true } },
      { name: 'RetirementJSON', text: { allowMultipleLines: true } },
      { name: 'IsRetired', boolean: {} },
    ]));
  }
  for (const [list, name, parent] of [['objectives', 'ParentGoalId', 'legacy'], ['kras', 'UnitObjective', 'objectives'], ['kpis', 'RelatedKRA', 'kras'], ['tasks', 'RelatedKPI', 'kpis'], ['tasks', 'RelatedKRA', 'kras']]) columns[list].push({ name, lookup: { listId: parent, allowMultipleValues: false } });
  columns.payloads = [{ name: 'PayloadKey', text: {}, enforceUniqueValues: true, indexed: true }, { name: 'Content', text: { allowMultipleLines: true } }];
  columns.kpis.push(
    { name: 'KpiOwner', text: { allowMultipleLines: true } },
    { name: 'Assignees', text: { allowMultipleLines: true } },
    { name: 'MeasurementDefinitionJSON', text: { allowMultipleLines: true } },
    { name: 'MeasurementEvidenceJSON', text: { allowMultipleLines: true } },
  );
  columns.plans.find(column => column.name === 'GoalsJSON').text.allowMultipleLines = true;
  columns.tasks.find(column => column.name === 'Assignees').text.allowMultipleLines = true;
  for (const [list, name] of [['objectives', 'Progress'], ['kras', 'Progress'], ['kpis', 'TargetValue'], ['kpis', 'ActualValue']]) columns[list].find(column => column.name === name).number = {};
  const client = { api(rawUrl) {
    const url = new URL(rawUrl, 'https://graph.test');
    const parts = url.pathname.split('/').filter(Boolean);
    const list = parts[3], id = parts[5];
    const headers = {};
    return { header(key, value) { headers[key] = value; return this; },
      async get() {
        if (parts.length === 3) return { value: Object.entries(names).map(([id, displayName]) => ({ id, displayName })) };
        if (parts[4] === 'columns') return { value: structuredClone(columns[list]) };
        if (id) { const item = data[list].get(id); if (!item) throw Error(`Missing ${list}:${id}`); return structuredClone(item); }
        let items = [...data[list].values()];
        const filter = url.searchParams.get('$filter');
        if (filter) {
          const match = filter.match(/^fields\/(\w+) eq '(.*)'$/);
          assert.ok(match, filter); items = items.filter(item => item.fields[match[1]] === match[2].replace(/''/g, "'"));
        }
        return { value: structuredClone(items) };
      },
      async post(body) {
        if (parts[4] === 'columns') { columns[list].push({ ...body, id: body.name }); return body; }
        if (controls.failCreate === list) { controls.failCreate = null; throw Error('Injected create failure'); }
        const key = body.fields.WorkPlanOperationKey || body.fields.PayloadKey;
        if (key && [...data[list].values()].some(item => (item.fields.WorkPlanOperationKey || item.fields.PayloadKey) === key)) throw Error('Unique key conflict');
        if (body.fields.Content) assert.ok(body.fields.Content.length <= 50000);
        const item = add(list, String(data[list].size + 100), body.fields);
        writes.push({ type: 'create', list, id: item.id, fields: structuredClone(body.fields) });
        if (controls.race === list) { controls.race = null; const parent = data.plans.get('1'); parent.eTag = 'newer'; parent.fields.ActivationJSON = JSON.stringify({ token: 'another-writer', state: 'running' }); }
        if (controls.loseCreate === list) { controls.loseCreate = null; throw Error('Response lost after successful create'); }
        return structuredClone(item);
      },
      async patch(fields) {
        if (parts[4] === 'columns') { Object.assign(columns[list].find(column => column.id === id), fields); return {}; }
        const item = data[list].get(id);
        if (headers['If-Match'] !== item.eTag) throw Error('412 stale version');
        if (fields.GoalsJSON) assert.ok(fields.GoalsJSON.length <= 50000);
        Object.assign(item.fields, structuredClone(fields)); item.eTag = `v${Number(item.eTag.slice(1)) + 1}`;
        writes.push({ type: 'update', list, id, fields: structuredClone(fields) }); return structuredClone(item.fields);
      },
    };
  } };
  return { client, data, columns, writes, controls, add, engine: new Engine(client, 'site') };
}

test('activation creates actual source KRAs, separate activity KPIs and ordinary Tasks without touching goal percentages', async () => {
  const plan = planFixture(), g = graph(plan);
  await g.engine.execute(plan);
  assert.equal(g.data.objectives.size, 1); assert.equal(g.data.kras.size, 2); assert.equal(g.data.kpis.size, 3); assert.equal(g.data.tasks.size, 3);
  assert.equal(g.data.legacy.get('42').fields.Progress, 73); assert.equal(g.data.corporate.get('42').fields.Progress, 61);
  const kpis = [...g.data.kpis.values()];
  assert.equal(kpis[0].fields.TargetValue, 12); assert.equal(kpis[1].fields.TargetValue, null);
  assert.equal(JSON.parse(kpis[1].fields.WorkPlanMetadataJSON).annualTarget.rawText, 'Continuous');
  assert.equal(JSON.parse(kpis[0].fields.MeasurementDefinitionJSON).mode, 'count');
  assert.equal(JSON.parse(kpis[1].fields.MeasurementDefinitionJSON).mode, 'service-level');
  assert.ok(kpis.every(item => item.fields.Status === 'Not Started'));
  assert.equal(g.data.plans.get('1').fields.Status, 'active');
  const objectives = [...g.data.objectives.values()];
  assert.equal(JSON.parse(objectives[0].fields.WorkPlanMetadataJSON).goalMeasures.length, 1);
});

test('repeated activation and a lost create response do not duplicate execution records', async () => {
  const plan = planFixture(), g = graph(plan); g.controls.loseCreate = 'kpis';
  await g.engine.execute(plan); await g.engine.execute(plan);
  assert.equal(g.data.objectives.size, 1); assert.equal(g.data.kras.size, 2); assert.equal(g.data.kpis.size, 3); assert.equal(g.data.tasks.size, 3);
});

test('partial failure checkpoints IDs and a stale form can resume the same intent', async () => {
  const plan = planFixture(), g = graph(plan); g.controls.failCreate = 'tasks';
  await assert.rejects(g.engine.execute(plan), /Injected create failure/);
  assert.equal(JSON.parse(g.data.plans.get('1').fields.ActivationJSON).state, 'failed');
  await g.engine.execute(plan);
  assert.equal(g.data.objectives.size, 1); assert.equal(g.data.kras.size, 2); assert.equal(g.data.kpis.size, 3); assert.equal(g.data.tasks.size, 3);
});

test('an interrupted activation must recover before a different intent runs', async () => {
  const plan = planFixture(), g = graph(plan); g.controls.failCreate = 'tasks';
  await assert.rejects(g.engine.execute(plan));
  plan.goals[0].activities[0].title = 'Changed intent';
  await assert.rejects(g.engine.execute(plan), /Recover the interrupted/);
});

test('an active lease prevents concurrent activation and a stale writer cannot overwrite a newer lease', async () => {
  const plan = planFixture(), g = graph(plan);
  g.data.plans.get('1').fields.ActivationJSON = JSON.stringify({ state: 'running', leaseUntil: Date.now() + 10000 });
  await assert.rejects(g.engine.execute(plan), /already running/);
  delete g.data.plans.get('1').fields.ActivationJSON; g.controls.race = 'objectives';
  await assert.rejects(g.engine.execute(plan), /412/);
  assert.equal(JSON.parse(g.data.plans.get('1').fields.ActivationJSON).token, 'another-writer');
});

test('wrong schema lookup targets fail before writes', async () => {
  const g = graph(); g.columns.objectives.find(column => column.name === 'ParentGoalId').lookup.listId = 'corporate';
  await assert.rejects(g.engine.execute(planFixture()), /wrong lookup target/);
  assert.equal(g.writes.length, 0);
});

test('same numeric corporate and legacy IDs require an explicit compatibility mapping', async () => {
  const plan = planFixture(), g = graph(plan);
  plan.goals[0].organizationalGoalRef.list = 'Strategic_Goals';
  await assert.rejects(g.engine.execute(plan), /explicit legacy compatibility/);
  assert.equal(g.writes.length, 0);
  plan.goals[0].legacyStrategicObjectiveId = '42'; await g.engine.execute(plan);
  const fields = [...g.data.objectives.values()][0].fields;
  assert.equal(fields.ParentGoalIdLookupId, 42);
  assert.equal(JSON.parse(fields.WorkPlanMetadataJSON).organizationalGoalRef.list, 'Strategic_Goals');
});

test('linking an existing Task preserves its identity, status, assignees, comments and attachments', async () => {
  const plan = planFixture(), g = graph(plan);
  Object.assign(plan.goals[0].activities[0], { linkedTaskIds: ['9'], taskPolicy: 'link-existing' });
  const fields = { Title: 'Existing task', Status: 'Completed', Assignees: '["owner"]', CommentsJSON: '["evidence"]', AttachmentsJSON: '["report"]' };
  g.add('tasks', '9', fields); await g.engine.execute(plan);
  for (const [name, value] of Object.entries(fields)) assert.equal(g.data.tasks.get('9').fields[name], value);
  assert.ok(g.data.tasks.get('9').fields.RelatedKPILookupId);
  assert.equal([...g.data.kpis.values()][0].fields.CalculationType, 'manual');
});

test('a Task already linked elsewhere is rejected before any writes', async () => {
  const plan = planFixture(), g = graph(plan);
  plan.goals[0].activities[0].linkedTaskIds = ['9']; g.add('tasks', '9', { RelatedKPILookupId: 999 });
  await assert.rejects(g.engine.execute(plan), /another KPI/); assert.equal(g.writes.length, 0);
});

test('removing activated activities cannot silently orphan execution records', async () => {
  const plan = planFixture(), g = graph(plan); await g.engine.execute(plan);
  const saved = { ...plan, goals: JSON.parse(g.data.plans.get('1').fields.GoalsJSON) };
  saved.goals[0].activities.pop(); await assert.rejects(g.engine.execute(saved), /retirement review/);
});

test('large plans use immutable payload chunks and preserve all source details', async () => {
  const g = graph(), storage = new Storage(g.client, 'site');
  const goals = Array.from({ length: 14 }, (_, index) => ({ ...planFixture().goals[0], id: `goal-${index}`, activities: Array.from({ length: 32 }, (_, n) => ({ ...planFixture().goals[0].activities[0], id: `${index}:${n}`, description: 'Source detail '.repeat(80) })) }));
  const encoded = await storage.encode(goals); assert.ok(encoded.length < 50000);
  assert.equal(JSON.parse(encoded).format, 'work-plan-goals-v1');
  assert.deepEqual(await new Storage(g.client, 'site').decode(encoded), goals);
  const count = g.data.payloads.size; await storage.encode(goals); assert.equal(g.data.payloads.size, count);
  const first = [...g.data.payloads.values()][0]; first.fields.Content = 'damaged';
  await assert.rejects(new Storage(g.client, 'site').decode(encoded), /checksum mismatch/);
});

test('metadata-only synchronization preserves existing actuals, statuses and stored progress', async () => {
  const plan = planFixture(), g = graph(plan); await g.engine.execute(plan);
  const objective = [...g.data.objectives.values()][0], kra = [...g.data.kras.values()][0], kpi = [...g.data.kpis.values()][0];
  objective.fields.Progress = 37; kra.fields.Progress = 61; kra.fields.Status = 'Closed';
  kpi.fields.ActualValue = 6; kpi.fields.Status = 'On Track'; kpi.fields.Weight = 3;
  plan.goals[0].title = 'Updated narrative title';
  await g.engine.execute(plan);
  assert.equal(objective.fields.Progress, 37); assert.equal(kra.fields.Progress, 61); assert.equal(kra.fields.Status, 'Closed');
  assert.equal(kpi.fields.ActualValue, 6); assert.equal(kpi.fields.Status, 'On Track'); assert.equal(kpi.fields.Weight, 3);
});

test('payload chunking preserves Unicode at chunk boundaries', async () => {
  const g = graph(), storage = new Storage(g.client, 'site');
  const goals = [{ ...planFixture().goals[0], description: '😀'.repeat(40000) }];
  const encoded = await storage.encode(goals);
  assert.deepEqual(await new Storage(g.client, 'site').decode(encoded), goals);
  for (const item of g.data.payloads.values()) {
    const content = item.fields.Content;
    assert.equal(/[\uD800-\uDBFF]$/.test(content), false);
  }
});

async function activatedRetirementFixture() {
  const plan = planFixture(), g = graph(plan);
  await g.engine.execute(plan);
  const goals = JSON.parse(g.data.plans.get('1').fields.GoalsJSON);
  const activity = goals[0].activities[0];
  const kpi = g.data.kpis.get(activity.linkedKpiId);
  kpi.fields.Status = 'Completed';
  kpi.fields.ActualValue = 9;
  kpi.fields.MeasurementEvidenceJSON = JSON.stringify({ evidenceRefs: ['register-1', 'report-1'] });
  kpi.fields.ChecklistJSON = JSON.stringify([{ id: 'check-1', completed: true }]);
  const task = g.data.tasks.get(activity.linkedTaskIds[0]);
  task.fields.CommentsJSON = JSON.stringify(['Officer evidence']);
  task.fields.AttachmentsJSON = JSON.stringify(['minutes.pdf']);
  return { plan, g, goals, activity, kpi, task };
}

test('retirement preview reports conserved evidence and exact old/new KRA percentage impacts', async () => {
  const { g, goals, activity } = await activatedRetirementFixture();
  const targetKraId = goals[0].kras[1].linkedKraId;
  const impact = await g.engine.previewActivityRetirement('1', activity.id, 'reassign', targetKraId);
  assert.equal(impact.sourceKra.activeKpiCount, 2);
  assert.equal(impact.sourceKra.progress, 50);
  assert.equal(impact.sourceKra.projectedProgress, 0);
  assert.equal(impact.targetKra.activeKpiCount, 1);
  assert.equal(impact.targetKra.progress, 0);
  assert.equal(impact.targetKra.projectedProgress, 50);
  assert.equal(impact.tasks.length, 1);
  assert.equal(impact.kpi.measurementEvidenceCount, 2);
  assert.equal(impact.kpi.hasMeasurementDefinition, true);
  assert.equal(impact.kpi.hasChecklistEvidence, true);
});

test('retire removes only the plan row, retains records and evidence, and excludes the KPI from rollups', async () => {
  const { g, activity, kpi, task } = await activatedRetirementFixture();
  const impact = await g.engine.previewActivityRetirement('1', activity.id, 'retire');
  await g.engine.executeActivityRetirement({ impact, reason: 'Obligation superseded by the approved 2027 plan.' });
  assert.equal(g.data.kpis.has(kpi.id), true);
  assert.equal(g.data.tasks.has(task.id), true);
  assert.equal(g.data.kpis.get(kpi.id).fields.IsRetired, true);
  assert.equal(g.data.tasks.get(task.id).fields.RelatedKPILookupId, Number(kpi.id));
  assert.equal(g.data.kpis.get(kpi.id).fields.ActualValue, 9);
  assert.equal(g.data.kpis.get(kpi.id).fields.MeasurementEvidenceJSON, JSON.stringify({ evidenceRefs: ['register-1', 'report-1'] }));
  assert.equal(g.data.tasks.get(task.id).fields.CommentsJSON, JSON.stringify(['Officer evidence']));
  assert.equal(JSON.parse(g.data.plans.get('1').fields.GoalsJSON)[0].activities.some(item => item.id === activity.id), false);
  const retirement = JSON.parse(g.data.plans.get('1').fields.RetirementJSON);
  assert.equal(retirement.history.length, 1);
  assert.equal(retirement.history[0].activitySnapshot.id, activity.id);
  assert.equal(retirement.operation, undefined);
});

test('clear linkage preserves Task identity and evidence while removing both strategy lookups', async () => {
  const { g, activity, task } = await activatedRetirementFixture();
  const impact = await g.engine.previewActivityRetirement('1', activity.id, 'clear-links');
  await g.engine.executeActivityRetirement({ impact, reason: 'Task remains operational but no longer contributes to this strategy.' });
  const saved = g.data.tasks.get(task.id);
  assert.equal(saved.fields.RelatedKPILookupId, null);
  assert.equal(saved.fields.RelatedKRALookupId, null);
  assert.equal(saved.fields.AttachmentsJSON, JSON.stringify(['minutes.pdf']));
  assert.equal(saved.fields.CommentsJSON, JSON.stringify(['Officer evidence']));
});

test('reassignment moves the KPI and every Task together without rewriting evidence or status', async () => {
  const { g, goals, activity, kpi, task } = await activatedRetirementFixture();
  const targetKraId = goals[0].kras[1].linkedKraId;
  const impact = await g.engine.previewActivityRetirement('1', activity.id, 'reassign', targetKraId);
  await g.engine.executeActivityRetirement({ impact, reason: 'Approved KRA ownership change.' });
  assert.equal(g.data.kpis.get(kpi.id).fields.RelatedKRALookupId, Number(targetKraId));
  assert.equal(g.data.tasks.get(task.id).fields.RelatedKRALookupId, Number(targetKraId));
  assert.equal(g.data.tasks.get(task.id).fields.RelatedKPILookupId, Number(kpi.id));
  assert.equal(g.data.kpis.get(kpi.id).fields.Status, 'Completed');
  assert.equal(g.data.kpis.get(kpi.id).fields.MeasurementEvidenceJSON, JSON.stringify({ evidenceRefs: ['register-1', 'report-1'] }));
  assert.equal(g.data.tasks.get(task.id).fields.AttachmentsJSON, JSON.stringify(['minutes.pdf']));
});

test('retirement fails closed when the reviewed plan version or target scope changes', async () => {
  const first = await activatedRetirementFixture();
  const impact = await first.g.engine.previewActivityRetirement('1', first.activity.id, 'retire');
  first.g.data.plans.get('1').eTag = 'external-edit';
  await assert.rejects(
    first.g.engine.executeActivityRetirement({ impact, reason: 'Reviewed reason' }),
    /changed after the impact preview/,
  );
  assert.equal(first.g.data.kpis.get(first.kpi.id).fields.IsRetired, undefined);

  const second = await activatedRetirementFixture();
  const targetKraId = second.goals[0].kras[1].linkedKraId;
  second.g.data.kras.get(targetKraId).fields.Division = 'Another division';
  await assert.rejects(
    second.g.engine.previewActivityRetirement('1', second.activity.id, 'reassign', targetKraId),
    /outside this work plan division/,
  );
});

test('source KRA reassignment moves every KPI and Task as one conserved subtree', async () => {
  const { g, goals } = await activatedRetirementFixture();
  const source = goals[0].kras[0], target = goals[0].kras[1];
  const sourceActivities = goals[0].activities.filter(activity => activity.sourceKraId === source.id);
  const sourceKpiIds = sourceActivities.map(activity => activity.linkedKpiId);
  const sourceTaskIds = sourceActivities.flatMap(activity => activity.linkedTaskIds);
  for (const id of sourceKpiIds) {
    g.data.kpis.get(id).fields.MeasurementEvidenceJSON = JSON.stringify({ evidenceRefs: [`evidence-${id}`] });
  }
  const impact = await g.engine.previewStructureRetirement('1', 'kra', source.id, 'reassign', target.linkedKraId);
  assert.deepEqual(new Set(impact.affected.kpiIds), new Set(sourceKpiIds));
  assert.deepEqual(new Set(impact.affected.taskIds), new Set(sourceTaskIds));
  assert.equal(impact.evidence.measurementEvidenceRefs, 2);
  assert.equal(impact.progress.find(item => item.kind === 'kra' && item.id === source.linkedKraId).projectedMemberCount, 0);
  assert.equal(impact.progress.find(item => item.kind === 'kra' && item.id === target.linkedKraId).projectedMemberCount, 3);

  await g.engine.executeStructureRetirement({ impact, reason: 'Approved consolidation of the source KRA.' });
  assert.equal(g.data.kras.get(source.linkedKraId).fields.IsRetired, true);
  for (const id of sourceKpiIds) {
    assert.equal(g.data.kpis.get(id).fields.RelatedKRALookupId, Number(target.linkedKraId));
    assert.equal(g.data.kpis.get(id).fields.IsRetired, false);
    assert.match(g.data.kpis.get(id).fields.MeasurementEvidenceJSON, /evidence-/);
  }
  for (const id of sourceTaskIds) {
    assert.equal(g.data.tasks.get(id).fields.RelatedKRALookupId, Number(target.linkedKraId));
  }
  const savedGoal = JSON.parse(g.data.plans.get('1').fields.GoalsJSON)[0];
  assert.equal(savedGoal.kras.some(kra => kra.id === source.id), false);
  assert.equal(savedGoal.activities.some(activity => activity.sourceKraId === source.id), false);
});

test('source KRA clear-links retires descendants without deleting Task evidence', async () => {
  const { g, goals } = await activatedRetirementFixture();
  const source = goals[0].kras[0];
  const sourceActivities = goals[0].activities.filter(activity => activity.sourceKraId === source.id);
  const kpiIds = sourceActivities.map(activity => activity.linkedKpiId);
  const taskIds = sourceActivities.flatMap(activity => activity.linkedTaskIds);
  for (const id of taskIds) {
    g.data.tasks.get(id).fields.CommentsJSON = JSON.stringify([`comment-${id}`]);
    g.data.tasks.get(id).fields.AttachmentsJSON = JSON.stringify([`attachment-${id}`]);
  }
  const impact = await g.engine.previewStructureRetirement('1', 'kra', source.id, 'clear-links');
  await g.engine.executeStructureRetirement({ impact, reason: 'The work remains operational outside the strategy chain.' });
  for (const id of kpiIds) assert.equal(g.data.kpis.get(id).fields.IsRetired, true);
  for (const id of taskIds) {
    const task = g.data.tasks.get(id);
    assert.equal(task.fields.RelatedKPILookupId, null);
    assert.equal(task.fields.RelatedKRALookupId, null);
    assert.match(task.fields.CommentsJSON, /comment-/);
    assert.match(task.fields.AttachmentsJSON, /attachment-/);
  }
});

test('goal reassignment moves every KRA under the reviewed objective without recreating descendants', async () => {
  const { g, goals } = await activatedRetirementFixture();
  const sourceGoal = goals[0];
  const sourceObjectiveId = sourceGoal.linkedObjectiveId;
  const kraIds = sourceGoal.kras.map(kra => kra.linkedKraId);
  const kpiIds = sourceGoal.activities.map(activity => activity.linkedKpiId);
  const taskLinks = Object.fromEntries(sourceGoal.activities.flatMap(activity =>
    activity.linkedTaskIds.map(id => [id, {
      kpi: g.data.tasks.get(id).fields.RelatedKPILookupId,
      kra: g.data.tasks.get(id).fields.RelatedKRALookupId,
    }])));
  g.add('objectives', '999', { Title: 'Approved receiving objective', Division: 'Licensing', Progress: 0, Status: 'Not Started' });
  g.add('kras', '998', { Title: 'Existing target KRA', Division: 'Licensing', UnitObjectiveLookupId: 999, Progress: 60, Status: 'Open' });

  const impact = await g.engine.previewStructureRetirement('1', 'goal', sourceGoal.id, 'reassign', '999');
  assert.deepEqual(new Set(impact.affected.kraIds), new Set(kraIds));
  assert.deepEqual(new Set(impact.affected.kpiIds), new Set(kpiIds));
  assert.equal(impact.progress.find(item => item.id === sourceObjectiveId).projectedMemberCount, 0);
  assert.equal(impact.progress.find(item => item.id === '999').projectedMemberCount, 3);
  await g.engine.executeStructureRetirement({ impact, reason: 'Approved objective ownership transfer.' });

  assert.equal(g.data.objectives.get(sourceObjectiveId).fields.IsRetired, true);
  for (const id of kraIds) assert.equal(g.data.kras.get(id).fields.UnitObjectiveLookupId, 999);
  for (const id of kpiIds) assert.notEqual(g.data.kpis.get(id).fields.IsRetired, true);
  for (const [id, links] of Object.entries(taskLinks)) {
    assert.equal(g.data.tasks.get(id).fields.RelatedKPILookupId, links.kpi);
    assert.equal(g.data.tasks.get(id).fields.RelatedKRALookupId, links.kra);
  }
  assert.equal(JSON.parse(g.data.plans.get('1').fields.GoalsJSON).length, 0);
  const history = JSON.parse(g.data.plans.get('1').fields.RetirementJSON).history;
  assert.equal(history[0].entityKind, 'goal');
  assert.equal(history[0].sourceSnapshot.id, sourceGoal.id);
});

test('goal retirement can clear all descendant Task links while retaining the full execution subtree', async () => {
  const { g, goals } = await activatedRetirementFixture();
  const sourceGoal = goals[0];
  const kraIds = sourceGoal.kras.map(kra => kra.linkedKraId);
  const kpiIds = sourceGoal.activities.map(activity => activity.linkedKpiId);
  const taskIds = sourceGoal.activities.flatMap(activity => activity.linkedTaskIds);
  const impact = await g.engine.previewStructureRetirement('1', 'goal', sourceGoal.id, 'clear-links');
  await g.engine.executeStructureRetirement({ impact, reason: 'Goal closed; operational records retained for audit.' });
  assert.equal(g.data.objectives.get(sourceGoal.linkedObjectiveId).fields.IsRetired, true);
  for (const id of kraIds) assert.equal(g.data.kras.get(id).fields.IsRetired, true);
  for (const id of kpiIds) assert.equal(g.data.kpis.get(id).fields.IsRetired, true);
  for (const id of taskIds) {
    assert.equal(g.data.tasks.get(id).fields.RelatedKPILookupId, null);
    assert.equal(g.data.tasks.get(id).fields.RelatedKRALookupId, null);
  }
  assert.equal(g.data.objectives.has(sourceGoal.linkedObjectiveId), true);
  assert.equal(g.data.kpis.size, 3);
  assert.equal(g.data.tasks.size, 3);
});

test('structure retirement rejects stale descendants and cross-division reassignment targets before writing', async () => {
  const stale = await activatedRetirementFixture();
  const sourceGoal = stale.goals[0];
  const impact = await stale.g.engine.previewStructureRetirement('1', 'goal', sourceGoal.id, 'retire');
  const changedKpiId = sourceGoal.activities[0].linkedKpiId;
  stale.g.data.kpis.get(changedKpiId).eTag = 'external-edit';
  await assert.rejects(
    stale.g.engine.executeStructureRetirement({ impact, reason: 'Reviewed goal closure.' }),
    /descendants changed after the impact preview/,
  );
  assert.equal(stale.g.data.objectives.get(sourceGoal.linkedObjectiveId).fields.IsRetired, undefined);

  const scoped = await activatedRetirementFixture();
  scoped.g.add('objectives', '999', {
    Title: 'Other division objective', Division: 'Corporate Services', Progress: 0, Status: 'Not Started',
  });
  await assert.rejects(
    scoped.g.engine.previewStructureRetirement('1', 'goal', scoped.goals[0].id, 'reassign', '999'),
    /outside this work plan division/,
  );
  assert.equal(scoped.g.data.objectives.get(scoped.goals[0].linkedObjectiveId).fields.IsRetired, undefined);
});

test('structure retirement rejects retired targets and changed source ancestry', async () => {
  const retiredTarget = await activatedRetirementFixture();
  const target = retiredTarget.goals[0].kras[1];
  retiredTarget.g.data.kras.get(target.linkedKraId).fields.IsRetired = true;
  await assert.rejects(
    retiredTarget.g.engine.previewStructureRetirement(
      '1', 'kra', retiredTarget.goals[0].kras[0].id, 'reassign', target.linkedKraId,
    ),
    /active target KRA/,
  );

  const changedAncestry = await activatedRetirementFixture();
  const source = changedAncestry.goals[0].kras[0];
  changedAncestry.g.data.kras.get(source.linkedKraId).fields.UnitObjectiveLookupId = 999;
  changedAncestry.g.add('objectives', '999', {
    Title: 'Unexpected parent', Division: 'Licensing', Progress: 0, Status: 'Not Started',
  });
  await assert.rejects(
    changedAncestry.g.engine.previewStructureRetirement('1', 'kra', source.id, 'retire'),
    /ancestry changed/,
  );
});
