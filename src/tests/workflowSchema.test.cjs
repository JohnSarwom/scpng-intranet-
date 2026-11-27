// Run with: node --test src/tests/workflowSchema.test.cjs
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

const schema = load('../workflows/workflowSchema.ts');
const { TASK_REGISTRY_TO_STRATEGIC_GOAL: builtIn } = load('../workflows/definitions/taskRegistryToStrategicGoal.ts');
const repoRoot = path.resolve(__dirname, '..', '..');

const minimal = () => ({
  schemaVersion: 1,
  id: 'leave-approval',
  title: 'Leave approval',
  status: 'draft',
  source: 'manual',
  nodes: [
    { id: 'request', label: 'Request leave', type: 'input', fields: [{ key: 'days', label: 'Days', kind: 'number', required: true }] },
    { id: 'decide', label: 'Manager decision', type: 'gate', gate: { mode: 'or', choiceField: 'decision' }, fields: [{ key: 'decision', label: 'Decision', kind: 'select', options: ['Approve', 'Return'] }] },
    { id: 'approved', label: 'Approved', type: 'end' },
  ],
  edges: [
    { from: 'request', to: 'decide' },
    { from: 'decide', to: 'approved', when: 'Approve' },
    { from: 'decide', to: 'request', when: 'Return', kind: 'feedback' },
  ],
});

test('the built-in Task Registry workflow is valid after layout', () => {
  const laidOut = schema.autoLayout(builtIn);
  assert.deepEqual(schema.validateWorkflow(laidOut), []);
  assert.equal(schema.findStartNode(laidOut).id, 'task');
  assert.ok(laidOut.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)));
});

test('every source file the built-in workflow cites exists', () => {
  const cited = new Set(builtIn.nodes.flatMap(node => node.details?.code || []));
  assert.ok(cited.size > 5);
  for (const file of cited) {
    assert.ok(fs.existsSync(path.join(repoRoot, file)), `${file} is cited by the Task Registry workflow but does not exist`);
  }
});

test('auto-layout stacks the flow bottom-up and puts side steps beside it', () => {
  const laidOut = schema.autoLayout(builtIn);
  const at = id => laidOut.nodes.find(node => node.id === id);
  assert.ok(at('task').y > at('alignment').y, 'later steps sit higher, as in V9');
  assert.ok(at('goal').y < at('objective').y);
  assert.equal(at('kpi').y, at('operational').y, 'both routes from a decision share a layer');
  assert.ok(at('corporate').x > at('goal').x, 'side tracks sit to the right');
  assert.ok(at('triage').x < at('task').x, 'feedback loops sit to the left');
});

test('a minimal workflow with a feedback route is valid', () => {
  assert.deepEqual(schema.validateWorkflow(minimal()), []);
});

test('structural problems are reported in plain words', () => {
  const broken = minimal();
  broken.edges.push({ from: 'approved', to: 'ghost' });
  assert.match(schema.validateWorkflow(broken).join(' '), /"ghost", which is not a step/);

  const noRoute = minimal();
  noRoute.edges = noRoute.edges.filter(edge => edge.when !== 'Return');
  assert.match(schema.validateWorkflow(noRoute).join(' '), /Option "Return" on "Manager decision" has no route/);

  const wrongWhen = minimal();
  wrongWhen.edges[1].when = 'Yes';
  assert.match(schema.validateWorkflow(wrongWhen).join(' '), /needs "when" set to one of: Approve, Return/);

  const twoStarts = minimal();
  twoStarts.nodes.push({ id: 'orphan', label: 'Orphan', type: 'end' });
  assert.match(schema.validateWorkflow(twoStarts).join(' '), /one starting step; found 2/);

  const deadEnd = minimal();
  deadEnd.nodes[2].type = 'auto';
  assert.match(schema.validateWorkflow(deadEnd).join(' '), /leads nowhere/);

  const duplicate = minimal();
  duplicate.nodes.push({ ...duplicate.nodes[2] });
  assert.match(schema.validateWorkflow(duplicate).join(' '), /used more than once/);
});

test('limits are enforced', () => {
  const big = minimal();
  for (let i = 0; i < 40; i += 1) big.nodes.push({ id: `extra${i}`, label: `Extra ${i}`, type: 'end', track: 'side' });
  assert.match(schema.validateWorkflow(big).join(' '), /At most 40 steps/);
});

test('normalising drops unknown properties, trims text and lays out missing positions', () => {
  const raw = minimal();
  raw.title = '  Leave approval  ';
  raw.nodes[0].script = '<script>alert(1)</script>';
  raw.extra = 'ignored';
  const definition = schema.normaliseWorkflow(raw);
  assert.equal(definition.title, 'Leave approval');
  assert.equal(definition.nodes[0].script, undefined);
  assert.equal(definition.extra, undefined);
  assert.ok(definition.nodes.every(node => Number.isFinite(node.x)));
});

test('AI replies are parsed from <workflow> tags, with readable errors otherwise', () => {
  const json = JSON.stringify({ ...minimal(), status: 'published', source: 'built-in' });
  const ok = schema.parseAiWorkflow(`Here is the workflow.\n<workflow>${json}</workflow>`);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.message, 'Here is the workflow.');
  assert.equal(ok.definition.status, 'draft', 'the AI cannot publish');
  assert.equal(ok.definition.source, 'ai');

  const fenced = schema.parseAiWorkflow('Done:\n```json\n' + json + '\n```');
  assert.ok(fenced.definition, 'a fenced JSON block is accepted');

  assert.match(schema.parseAiWorkflow('I could not do that.').errors[0], /did not include a workflow/);
  assert.match(schema.parseAiWorkflow('<workflow>{ not json }</workflow>').errors[0], /not valid JSON/);

  const badEdge = JSON.parse(json);
  badEdge.edges.push({ from: 'decide', to: 'nowhere', when: 'Approve' });
  const invalid = schema.parseAiWorkflow(`<workflow>${JSON.stringify(badEdge)}</workflow>`);
  assert.equal(invalid.definition, null);
  assert.match(invalid.errors.join(' '), /nowhere/);

  const kept = schema.parseAiWorkflow(`<workflow>${json}</workflow>`, { keepId: 'my-saved-id' });
  assert.equal(kept.definition.id, 'my-saved-id', 'refining a saved workflow keeps its ID');
});

test('workflow IDs are slugified from titles', () => {
  assert.equal(schema.slugifyWorkflowId('Leave approval (HR)'), 'leave-approval-hr');
  assert.equal(schema.slugifyWorkflowId('!'), 'workflow-new');
});
