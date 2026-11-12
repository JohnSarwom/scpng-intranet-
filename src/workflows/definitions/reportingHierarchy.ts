/**
 * Built-in structure chart: who reports to whom at SCPNG, from "01 — Reporting
 * Hierarchy" (12 November 2026), refined against the app.
 *
 * Posts only; the units are in organisationalStructure.ts. Each box's
 * appStatus and details.today say whether the app has that level in its roles
 * and approval routing. Every `details.code` path is checked by a test.
 */

import type { AppStatus, WorkflowDefinition, WorkflowEdge, WorkflowNode } from '../workflowTypes';

const LEAVE_ROUTING = 'src/services/hrSharePointService.ts';
const APPROVER_ADMIN = 'src/components/hr/WorkflowAdmin.tsx';
const USER_ADMIN = 'src/components/admin/UserManagement.tsx';
const TASK_FORM = 'src/components/unit-tabs/TaskDialog.tsx';

const LIVE_APPROVERS = 'Live, only the IT Unit has leave approvers set up (plus one CEO Review approver).';
const DIRECTOR_TODAY =
  `Directors approve leave at the “Director Review” stage, set per division and unit in HR → Workflow admin; a unit can skip it. ${LIVE_APPROVERS} There is no Director role in Admin → Users (directors are Manager or Admin users), though KPIs have a “director” level. Tasks never go to a Director.`;
const MANAGER_TODAY =
  `Managers approve leave first (“Manager Review”). ${LIVE_APPROVERS} Users with the Manager role can add and edit KRAs and KPIs and link a task to any KPI. Tasks have no manager approval step.`;
const MISSING_UNIT_TODAY = (unit: string) => `The ${unit} isn’t in the app’s unit lists, live or in code, so this post can’t be set up as an approver.`;
const SENIOR_TODAY =
  'The post exists in practice: 9 job titles in the staff directory start with or include “Senior”. But the app has no Senior Officer level: no role, approval stage or KPI level.';
const OFFICER_TODAY =
  'Staff Member role: works tasks, and can link a task only to KPIs assigned to them. KPIs have a “staff” level.';

const post = (
  id: string,
  label: string,
  rank: WorkflowNode['rank'],
  appStatus: AppStatus | undefined,
  rules: string[],
  today?: string,
  code?: string[],
  sub?: string,
): WorkflowNode => ({
  id,
  label,
  ...(sub ? { sub } : {}),
  type: 'org',
  rank,
  ...(appStatus ? { appStatus } : {}),
  details: { rules, ...(today ? { today } : {}), ...(code ? { code } : {}) },
});

/**
 * A manager with the generic Senior Officer(s) and Officer(s) beneath. A
 * manager counts as built only where their unit's leave approvers are set up.
 */
function team(key: string, manager: string, unitName: string, unitExists = true, approversSetUp = false): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const managerId = `${key}-manager`, seniorId = `${key}-senior`, officerId = `${key}-officer`;
  return {
    nodes: [
      post(managerId, manager, 'manager', !unitExists ? 'missing' : approversSetUp ? 'built' : 'partial',
        ['Allocates work, supervises Senior Officers and Officers, reviews performance and consolidates unit results.', 'Reports to the Director.'],
        unitExists ? MANAGER_TODAY : MISSING_UNIT_TODAY(unitName), unitExists ? [LEAVE_ROUTING, TASK_FORM] : [USER_ADMIN], unitName),
      post(seniorId, 'Senior Officer(s)', 'senior', 'missing',
        ['Coordinates Officers, verifies their outputs and escalates progress or exceptions to the Manager.', 'Placeholder: not a confirmed post or headcount.'],
        SENIOR_TODAY, [USER_ADMIN], unitName),
      post(officerId, 'Officer(s)', 'officer', unitExists ? 'built' : 'missing',
        ['Carries out the work and reports tasks, deadlines and evidence to the Senior Officer.', 'Placeholder: not a confirmed post or headcount.'],
        unitExists ? OFFICER_TODAY : MISSING_UNIT_TODAY(unitName), unitExists ? [TASK_FORM] : [USER_ADMIN], unitName),
    ],
    edges: [{ from: managerId, to: seniorId }, { from: seniorId, to: officerId }],
  };
}

const director = (id: string, label: string, division: string, teams: Array<ReturnType<typeof team>>) => ({
  node: post(id, label, 'director', 'partial',
    [`Leads the ${division}: oversees its units’ responsibilities and performance, and escalates to the CEO.`, 'Reports to the CEO.'],
    DIRECTOR_TODAY, [LEAVE_ROUTING, APPROVER_ADMIN, USER_ADMIN], division),
  teams,
});

const divisions = [
  director('csd-director', 'Director Corporate Services', 'Corporate Services Division', [
    team('finance', 'Manager Finance', 'Finance Unit'),
    team('hr', 'Manager HR', 'Human Resource Unit'),
    team('it', 'Manager IT', 'IT Unit', true, true),
  ]),
  director('lsd-director', 'Director Legal Services', 'Legal Services Division', [
    team('legal-advisory', 'Manager Legal Advisory', 'Legal Advisory Unit'),
    team('legal-enforcement', 'Manager Legal Enforcement & Compliance', 'Legal Enforcement & Compliance Unit', false),
  ]),
  director('lisd-director', 'Director LIS', 'Licensing, Investigation & Supervision Division', [
    team('licensing', 'Manager Licensing', 'Licensing Unit'),
    team('supervision', 'Manager Supervision', 'Supervision Unit'),
    team('investigations', 'Manager Investigations', 'Investigations Unit'),
    team('market-data', 'Manager Market Data', 'Market Data Unit'),
  ]),
  director('rpd-director', 'Director R&P', 'Research & Publication Division', [
    team('research', 'Manager Research', 'Research Unit'),
    team('media', 'Manager Media & Publication', 'Media & Publication Unit'),
    team('investments', 'Manager Investments', 'Investments Unit', false),
  ]),
];

const nodes: WorkflowNode[] = [
  post('board', 'SCPNG Board', 'board', 'missing',
    ['Governance and strategic oversight. The CEO reports to the Board.', 'Task escalation stops at the CEO; the Board receives strategic reporting, not routine approvals.'],
    'No Board role or approval stage in the app.', [USER_ADMIN]),
  post('ceo', 'Chief Executive Officer', 'executive', 'partial',
    ['Reports to the Board.', 'Directors, the General Counsel, Manager Internal Audit and the Secretariat Unit report to the CEO.'],
    'The CEO approves leave at the “CEO Review” stage (approvers set in HR → Workflow admin), used for the Office of the Chairman, the Executive Division, the Secretariat and anyone whose profile reports to the CEO. There is no CEO role in Admin → Users, and KPIs have no CEO level.',
    [LEAVE_ROUTING, APPROVER_ADMIN, USER_ADMIN]),
  post('secretariat', 'Secretariat Unit', 'office', 'partial',
    ['Reports directly to the CEO.'],
    'Secretariat staff already take the CEO leave route (CEO Review, then HR Review), which matches this line. The Strategy page shows the Secretariat’s head as “General Counsel / Manager Audit”, which doesn’t.',
    [LEAVE_ROUTING, 'src/pages/Strategy.tsx']),
  post('general-counsel', 'General Counsel', 'office', 'partial',
    ['Reports directly to the CEO.', 'The Executive Officer reports to the General Counsel. The divisions do not.'],
    'The live Strategy_Divisions list names the General Counsel as head of the “Executive Division”, but no approval stage routes to the General Counsel, and Executive Division leave goes to the CEO.',
    ['src/services/divisionService.ts', 'src/hooks/useUIRoles.ts', LEAVE_ROUTING]),
  post('executive-officer', 'Executive Officer', 'officer', 'missing',
    ['Reports to the General Counsel.'],
    'One staff directory job title is “Executive Officer”, but the app has no General Counsel unit to set its approver in.', [USER_ADMIN], 'Office of the General Counsel'),
  post('audit-manager', 'Manager Internal Audit', 'manager', 'missing',
    ['Reports directly to the CEO.', 'Supervises the Internal Audit Senior Officer and Officer.'],
    MISSING_UNIT_TODAY('Internal Audit Unit'), [USER_ADMIN], 'Internal Audit Unit'),
  post('audit-senior', 'Senior Officer', 'senior', 'missing',
    ['Reports to the Manager Internal Audit.'], SENIOR_TODAY, [USER_ADMIN], 'Internal Audit Unit'),
  post('audit-officer', 'Officer', 'officer', 'missing',
    ['Reports to the Senior Officer, Internal Audit.'], MISSING_UNIT_TODAY('Internal Audit Unit'), [USER_ADMIN], 'Internal Audit Unit'),
  post('directors', 'Divisional Directors', 'group', undefined,
    ['Drawn only to keep the divisions on one row. Each Director reports straight to the CEO.'], undefined, undefined, 'Each reports to the CEO'),
  ...divisions.flatMap(division => [division.node, ...division.teams.flatMap(item => item.nodes)]),
];

const edges: WorkflowEdge[] = [
  { from: 'board', to: 'ceo' },
  { from: 'ceo', to: 'secretariat' },
  { from: 'ceo', to: 'general-counsel' },
  { from: 'general-counsel', to: 'executive-officer' },
  { from: 'ceo', to: 'audit-manager' },
  { from: 'audit-manager', to: 'audit-senior' },
  { from: 'audit-senior', to: 'audit-officer' },
  { from: 'ceo', to: 'directors' },
  ...divisions.flatMap(division => [
    { from: 'directors', to: division.node.id },
    ...division.teams.flatMap(item => [{ from: division.node.id, to: item.nodes[0].id }, ...item.edges]),
  ]),
];

export const REPORTING_HIERARCHY: WorkflowDefinition = {
  schemaVersion: 1,
  id: 'reporting-hierarchy',
  title: 'Reporting hierarchy',
  summary:
    'Who reports to whom, from Officer to the Board. Use it for accountability and escalation. Each box says whether the app has that level in its roles and approval routing today.',
  area: 'Organisation',
  status: 'target',
  source: 'built-in',
  kind: 'hierarchy',
  notes: [
    'Divisions: Officer → Senior Officer → Manager → Director → CEO → Board. They do not report through the General Counsel.',
    'Executive Officer → General Counsel → CEO. Internal Audit: Officer → Senior Officer → Manager Internal Audit → CEO.',
    'Reporting lines set accountability and escalation; a task’s KPI link can cross them. Senior Officer(s) and Officer(s) are placeholders, not confirmed posts.',
  ],
  nodes,
  edges,
};
