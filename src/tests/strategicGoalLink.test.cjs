// Run with: node --test src/tests/strategicGoalLink.test.cjs
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
  goalTitleKey,
  matchGoalByTitle,
  missingCorporatePlanGoals,
  proposeGoalCrosswalk,
  crosswalkChanges,
  CORPORATE_PLAN_GOALS,
} = load('../utils/strategicGoalLink.ts');

// The four Corporate Plan goals as they would sit in Strategic_Goals.
const planGoals = [
  { id: '21', title: 'Policy Development' },
  { id: '22', title: 'Enforcement and Compliance' },
  { id: '23', title: 'Education & Awareness' },
  { id: '24', title: 'Enhance Institutional Performance' },
];

test('goal titles compare without the "Strategic Goal N" prefix, punctuation or "&"', () => {
  assert.equal(goalTitleKey('Strategic Goal 2 — Enforcement & Compliance'), 'enforcement and compliance');
  assert.equal(goalTitleKey('Strategic Goal 1: Policy Development'), 'policy development');
  assert.equal(goalTitleKey('  Education & Awareness '), 'education and awareness');
});

test('seeded goal titles match the Corporate Plan goals, and ambiguity matches nothing', () => {
  assert.equal(matchGoalByTitle('Strategic Goal 2 — Enforcement & Compliance', planGoals).goal.id, '22');
  const partial = matchGoalByTitle('Strategic Goal 4 — Institutional Performance', planGoals);
  assert.deepEqual([partial.goal.id, partial.how], ['24', 'partial']);
  assert.equal(matchGoalByTitle('Strategic Goal 5 — International & Inter-Agency Cooperation', planGoals), null);
  // A single shared word is not enough evidence.
  assert.equal(matchGoalByTitle('Development', planGoals), null);
  // Two goals that both match is ambiguous, not a pick.
  assert.equal(matchGoalByTitle('Policy Development', [...planGoals, { id: '99', title: 'policy development' }]), null);
});

test('missing Corporate Plan goals are listed against what Strategic_Goals already holds', () => {
  assert.equal(CORPORATE_PLAN_GOALS.length, 4);
  assert.deepEqual(missingCorporatePlanGoals(planGoals), []);
  const demoGoals = [
    { id: '1', title: 'Markets & Connectivity' },
    { id: '2', title: 'Regulatory Reform' },
    { id: '3', title: 'Policy Development' },
  ];
  assert.deepEqual(missingCorporatePlanGoals(demoGoals).map(g => g.number), [2, 3, 4]);
});

// The framework seed's shape: goals as Org rows in Unit_Objectives, Key Deliverables
// pointing at them through ParentGoalId, placeholder initiatives pointing at the KDs.
const seededObjectives = [
  { id: '100', title: 'Strategic Goal 1 — Policy Development', goalType: 'Org' },
  { id: '104', title: 'Strategic Goal 4 — Institutional Performance', goalType: 'Org' },
  { id: '105', title: 'Strategic Goal 5 — International & Inter-Agency Cooperation', goalType: 'Org' },
  { id: '200', title: 'KRA 1.1: Legislation', goalType: 'Unit', division: 'Office of the Chairman', unit: 'Secretariat Unit', parentGoalId: '100', linkedDeliverable: 'Strategic Goal 1 — Policy Development', revision: '"r200"' },
  { id: '201', title: 'KRA 4.3: IT systems', goalType: 'Unit', division: 'Corporate Services Division', unit: 'IT Unit', parentGoalId: '104', linkedDeliverable: 'Strategic Goal 4 — Institutional Performance' },
  { id: '202', title: 'KRA 5.1: IOSCO MOU', goalType: 'Unit', division: 'Legal Services Division', unit: 'Legal Advisory Unit', parentGoalId: '105', linkedDeliverable: 'Strategic Goal 5 — International & Inter-Agency Cooperation' },
  { id: '300', title: 'KRA 1.1: Legislation', goalType: 'Division', division: 'Office of the Chairman', unit: 'Secretariat Unit', parentGoalId: '200', linkedDeliverable: 'KRA 1.1: Legislation' },
  { id: '400', title: 'Already linked', goalType: 'Division', division: 'Corporate Services Division', unit: 'HR Unit', strategicGoalId: '24' },
  { id: '401', title: 'Link to deleted goal', goalType: 'Division', division: 'Corporate Services Division', unit: 'HR Unit', strategicGoalId: '77' },
  { id: '402', title: 'No evidence', goalType: 'Division', division: 'Corporate Services Division', unit: 'Finance Unit' },
];

test('the crosswalk proposes goals for seeded objectives and leaves the rest for review', () => {
  const rows = proposeGoalCrosswalk({ objectives: seededObjectives, goals: planGoals });
  const byId = Object.fromEntries(rows.map(r => [r.objectiveId, r]));

  assert.ok(!byId['100'] && !byId['104'], 'organisation-level rows are not objectives to link');
  assert.deepEqual([byId['200'].status, byId['200'].proposedGoalId, byId['200'].basis], ['proposed', '21', 'deliverable-title']);
  assert.deepEqual([byId['201'].status, byId['201'].proposedGoalId], ['proposed', '24']);
  assert.equal(byId['202'].status, 'unresolved', 'the seed\'s fifth goal is not in the Corporate Plan');
  assert.deepEqual([byId['300'].status, byId['300'].proposedGoalId, byId['300'].basis], ['proposed', '21', 'parent-objective']);
  assert.deepEqual([byId['400'].status, byId['400'].proposedGoalId], ['linked', '24']);
  assert.deepEqual([byId['401'].status, byId['401'].currentGoalValid], ['unresolved', false]);
  assert.match(byId['401'].evidence.join(' '), /not in Strategic_Goals/);
  assert.equal(byId['402'].status, 'unresolved');
});

test('evidence that points to two different goals is a conflict, not a guess', () => {
  const rows = proposeGoalCrosswalk({
    objectives: [{ id: '1', title: 'Mixed', goalType: 'Unit', linkedDeliverable: 'Policy Development', parentGoalId: '9' }],
    goals: planGoals,
    legacyObjectives: [{ id: '9', title: 'Education & Awareness' }],
  });
  assert.equal(rows[0].status, 'conflict');
  assert.equal(rows[0].proposedGoalId, null);
});

test('approved changes include only rows whose link would change, honouring the reviewer\'s picks', () => {
  const rows = proposeGoalCrosswalk({ objectives: seededObjectives, goals: planGoals });
  const changes = crosswalkChanges(rows, { '202': '24', '401': null });
  const byId = Object.fromEntries(changes.map(c => [c.objectiveId, c]));

  assert.deepEqual(byId['200'], { objectiveId: '200', revision: '"r200"', fromGoalId: null, toGoalId: '21' });
  assert.equal(byId['202'].toGoalId, '24', 'a reviewer pick applies to an unresolved row');
  assert.deepEqual([byId['401'].fromGoalId, byId['401'].toGoalId], ['77', null], 'clearing a broken link is a change');
  assert.ok(!byId['400'], 'an already-correct link is not rewritten');
  assert.ok(!byId['402'], 'an unresolved row with no pick is left alone');
});

test('the crosswalk does not mutate its input', () => {
  const snapshot = JSON.stringify(seededObjectives);
  proposeGoalCrosswalk({ objectives: seededObjectives, goals: planGoals });
  assert.equal(JSON.stringify(seededObjectives), snapshot);
});
