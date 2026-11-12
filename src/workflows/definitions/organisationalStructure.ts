/**
 * Built-in structure chart: the agreed SCPNG organisational structure, from
 * "03 — Organisational Structure" (12 November 2026), refined against the app.
 *
 * Units only; the posts and who reports to whom are in reportingHierarchy.ts.
 * Each box's appStatus and details.today say whether the app's division and
 * unit lists match it. The "live" facts were read from the Strategy_Divisions
 * and Strategy_Units lists and the staff directory on 12 November 2026.
 * Every `details.code` path is checked by a test.
 */

import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from '../workflowTypes';

const SEED = 'src/services/kraKpiSeedService.ts';
const ORG_CHART = 'src/components/strategy/OrgChart.tsx';
const USER_ADMIN = 'src/components/admin/UserManagement.tsx';
const DIVISIONS_FILE = 'src/data/divisions.ts';
const LIVE_UNITS = 'src/services/unitService.ts';
const LIVE_DIVISIONS = 'src/services/divisionService.ts';
/** 10 of the 12 rows in the live Strategy_Units list have this placeholder as their division. */
const UNLINKED = 'In the live Strategy_Units list its division is the placeholder “Related Division”, so it isn’t linked to its division.';

const unit = (id: string, label: string, head: string, appStatus: WorkflowNode['appStatus'], today: string, code: string[] = [SEED, USER_ADMIN, LIVE_UNITS]): WorkflowNode => ({
  id,
  label,
  sub: head,
  type: 'org',
  rank: 'unit',
  appStatus,
  details: { rules: [`Led by the ${head}.`], today, code },
});

const nodes: WorkflowNode[] = [
  {
    id: 'board',
    label: 'SCPNG Board',
    sub: 'Governance and oversight',
    type: 'org',
    rank: 'board',
    appStatus: 'missing',
    details: {
      rules: ['Provides governance and strategic oversight.', 'The CEO reports to the Board.'],
      today: 'There is no Board level in the app’s division and unit lists, user roles or approval stages. Board-level output exists only as strategy reports (frozen in the report archive, or scheduled).',
      code: ['src/services/strategyReportArchiveService.ts'],
    },
  },
  {
    id: 'ceo',
    label: 'Office of the CEO',
    sub: 'Chief Executive Officer',
    type: 'org',
    rank: 'executive',
    appStatus: 'partial',
    details: {
      rules: [
        'Led by the Chief Executive Officer, who reports to the Board.',
        'The Secretariat Unit, the Office of the General Counsel, the Internal Audit Unit and the four divisions all report to the CEO.',
      ],
      today: 'Recorded as the “Office of the Chairman” division, with the CEO as its head, in the live Strategy_Divisions list, the strategy seed and the org chart. Admin → Users uses an “Executive Division” with an Executive Unit instead. Leave requests from the Office of the Chairman, the Executive Division and the Secretariat, and from staff whose profile reports to the CEO, go to the “CEO Review” stage.',
      code: [LIVE_DIVISIONS, SEED, ORG_CHART, USER_ADMIN, 'src/services/hrSharePointService.ts'],
    },
  },
  {
    id: 'secretariat',
    label: 'Secretariat Unit',
    sub: 'Reports to the CEO',
    type: 'org',
    rank: 'office',
    appStatus: 'partial',
    details: {
      rules: ['Reports directly to the CEO.'],
      today: 'The live Strategy_Units list puts it under “Office of the Chairman”, which matches this design. Elsewhere it is filed differently: under “Executive Division” and also as a division of its own (Admin → Users), and as a division in src/data/divisions.ts. The Strategy page shows its head as “General Counsel / Manager Audit”. Its staff already use the CEO leave route.',
      code: [LIVE_UNITS, USER_ADMIN, DIVISIONS_FILE, 'src/pages/Strategy.tsx'],
    },
  },
  {
    id: 'general-counsel',
    label: 'Office of the General Counsel',
    sub: 'General Counsel, Executive Officer',
    type: 'org',
    rank: 'office',
    appStatus: 'partial',
    details: {
      rules: [
        'Led by the General Counsel, who reports to the CEO.',
        'The Executive Officer reports to the General Counsel.',
        'The divisions do not report through the General Counsel.',
      ],
      today: 'Not under this name. The live Strategy_Divisions list has an “Executive Division” whose head is the General Counsel, so that is probably this office; it is also listed as a unit. The app routes Executive Division leave to the CEO, which fits. The Strategy page heading “General Counsel / Manager Audit” for the Secretariat doesn’t.',
      code: [LIVE_DIVISIONS, LIVE_UNITS, 'src/hooks/useUIRoles.ts', 'src/pages/Strategy.tsx'],
    },
  },
  {
    id: 'internal-audit',
    label: 'Internal Audit Unit',
    sub: 'Manager Internal Audit',
    type: 'org',
    rank: 'office',
    appStatus: 'missing',
    details: {
      rules: ['Reports directly to the CEO.', 'Manager Internal Audit, with a Senior Officer and an Officer beneath.'],
      today: 'Not in any division or unit list, live or in code, and no one in the staff directory has an Internal Audit job title or department. So no leave approver, task group or unit page can be set up for it. It appears only in Strategy page text (“Secretariat & Internal Audit Units”) and as a fallback name in the SharePoint setup service.',
      code: ['src/pages/Strategy.tsx', 'src/services/sharePointListSetupService.ts'],
    },
  },
  {
    id: 'divisions',
    label: 'Four divisions',
    sub: 'Each reports to the CEO',
    type: 'org',
    rank: 'group',
    details: {
      rules: ['Drawn only to keep the divisions on one row. It is not a unit or post: each Director reports straight to the CEO.'],
    },
  },
  {
    id: 'csd',
    label: 'Corporate Services Division (CSD)',
    sub: 'Director Corporate Services',
    type: 'org',
    rank: 'division',
    appStatus: 'built',
    details: {
      rules: ['Led by the Director Corporate Services.', 'Units: Finance, Human Resources, IT.'],
      today: 'Same name in every list, live and in code. Admin → Users also offers a “Corporate Services Unit” and “Administrative Services” under it, which this structure doesn’t include.',
      code: [LIVE_DIVISIONS, SEED, ORG_CHART, USER_ADMIN],
    },
  },
  unit('finance', 'Finance Unit', 'Manager Finance', 'partial', `Named “Finance Unit” everywhere. ${UNLINKED}`),
  unit('hr', 'Human Resource Unit', 'Manager HR', 'partial', `“Human Resource Unit” in the live list, the staff directory, the strategy seed and the org chart; only Admin → Users spells it “Human Resources Unit”. Approvers and division scope match units by name, so the two spellings don’t match each other. ${UNLINKED}`, [LIVE_UNITS, SEED, ORG_CHART, USER_ADMIN]),
  unit('it', 'IT Unit', 'Manager IT', 'partial', `Named “IT Unit” everywhere, and the only unit with leave approvers set up (Manager, Director and HR). ${UNLINKED}`, [LIVE_UNITS, USER_ADMIN, 'src/components/hr/WorkflowAdmin.tsx']),
  {
    id: 'lsd',
    label: 'Legal Services Division (LSD)',
    sub: 'Director Legal Services',
    type: 'org',
    rank: 'division',
    appStatus: 'partial',
    details: {
      rules: ['Led by the Director Legal Services.', 'Units: Legal Advisory, Legal Enforcement & Compliance.'],
      today: 'The division is in every list, but with only one unit, Legal Advisory. The live Strategy_Divisions list names a Legal Manager as its head; no Director Legal Services is recorded.',
      code: [LIVE_DIVISIONS, SEED, ORG_CHART, USER_ADMIN],
    },
  },
  unit('legal-advisory', 'Legal Advisory Unit', 'Manager Legal Advisory', 'partial', `Named “Legal Advisory Unit” everywhere. ${UNLINKED}`),
  unit('legal-enforcement', 'Legal Enforcement & Compliance Unit', 'Manager Legal Enforcement & Compliance', 'missing', 'Not in any unit list, live or in code. The post exists: there is a “Legal Manager - Compliance & Enforcement” job title, and one staff member’s directory job title mentions enforcement.', [USER_ADMIN, 'src/hooks/useUIRoles.ts']),
  {
    id: 'lisd',
    label: 'Licensing, Investigation & Supervision Division (LISD)',
    sub: 'Director LIS',
    type: 'org',
    rank: 'division',
    appStatus: 'partial',
    details: {
      rules: ['Led by the Director LIS.', 'Units: Licensing, Supervision, Investigations, Market Data.'],
      today: 'The live Strategy_Divisions list, the strategy seed and the org chart call it “Licensing, Market & Supervision Division”; Admin → Users and src/data/divisions.ts call it “Licensing Market & Supervision Division” (LMSD). One staff member’s directory department already reads “Licensing Investigation and Supervision Division”. Its four units match. One official name is needed before the lists are aligned.',
      code: [LIVE_DIVISIONS, SEED, ORG_CHART, USER_ADMIN, DIVISIONS_FILE],
    },
  },
  unit('licensing', 'Licensing Unit', 'Manager Licensing', 'built', 'Named “Licensing Unit” everywhere, and linked to its division in the live Strategy_Units list.'),
  unit('supervision', 'Supervision Unit', 'Manager Supervision', 'partial', `Named “Supervision Unit” everywhere. ${UNLINKED}`),
  unit('investigations', 'Investigations Unit', 'Manager Investigations', 'partial', `Named “Investigations Unit” everywhere. ${UNLINKED}`),
  unit('market-data', 'Market Data Unit', 'Manager Market Data', 'partial', `Named “Market Data Unit” everywhere. ${UNLINKED}`),
  {
    id: 'rpd',
    label: 'Research & Publication Division (RPD)',
    sub: 'Director R&P',
    type: 'org',
    rank: 'division',
    appStatus: 'partial',
    details: {
      rules: ['Led by the Director R&P.', 'Units: Research, Media & Publication, Investments.'],
      today: 'The division is in every list, without the Investments Unit. Staff directory departments spell it three ways (“Research & Publication”, “Research and Publication”, and the unit names).',
      code: [LIVE_DIVISIONS, SEED, ORG_CHART, USER_ADMIN],
    },
  },
  unit('research', 'Research Unit', 'Manager Research', 'partial', `Named “Research Unit” everywhere. ${UNLINKED}`),
  unit('media', 'Media & Publication Unit', 'Manager Media & Publication', 'partial', `“Publication Unit” in the live list, the staff directory, the strategy seed and the org chart; “Media & Publication Unit” only in Admin → Users. ${UNLINKED}`, [LIVE_UNITS, SEED, ORG_CHART, USER_ADMIN]),
  unit('investments', 'Investments Unit', 'Manager Investments', 'missing', 'Not in any unit list, live or in code, and no one in the staff directory has an Investments job title.', [USER_ADMIN]),
];

const reports = (from: string, ...to: string[]): WorkflowEdge[] => to.map(id => ({ from, to: id }));

export const ORGANISATIONAL_STRUCTURE: WorkflowDefinition = {
  schemaVersion: 1,
  id: 'organisational-structure',
  title: 'Organisational structure',
  summary:
    'The agreed SCPNG structure: the Board, the CEO, the three units that report to the CEO, and the four divisions with their units. Each box says whether the app’s division and unit lists match it today.',
  area: 'Organisation',
  status: 'target',
  source: 'built-in',
  kind: 'hierarchy',
  notes: [
    'Agreed structure. The app’s division and unit names come from several places that don’t agree yet; open a box to see how the app records it (live lists checked 12 November 2026).',
    'In the live Strategy_Units list, 10 of the 12 units aren’t linked to their division.',
    'Posts and reporting lines are in “Reporting hierarchy”.',
  ],
  nodes,
  edges: [
    ...reports('board', 'ceo'),
    ...reports('ceo', 'secretariat', 'general-counsel', 'internal-audit', 'divisions'),
    ...reports('divisions', 'csd', 'lsd', 'lisd', 'rpd'),
    ...reports('csd', 'finance', 'hr', 'it'),
    ...reports('lsd', 'legal-advisory', 'legal-enforcement'),
    ...reports('lisd', 'licensing', 'supervision', 'investigations', 'market-data'),
    ...reports('rpd', 'research', 'media', 'investments'),
  ],
};
